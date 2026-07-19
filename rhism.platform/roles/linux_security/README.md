# linux_security

Linux security orchestrator for EL 8/9/10 — composes `linux_packages`, `linux_hardening`, `firewall`, `linux_auditing`, `linux_users`, and `linux_selinux` roles via `include_role`. Boolean flags control which domains are applied.

Namespace: `cx_ansible_galaxy`. Published as `cx_ansible_galaxy.linux_security`.
Orchestration repo: `../../` — playbooks, inventory, CI scripts, and full platform `CLAUDE.md` live there.

## Requirements

- All constituent roles must be present in `ANSIBLE_ROLES_PATH`:
  - `cx_ansible_galaxy.linux_packages` (`roles/linux_packages/`)
  - `cx_ansible_galaxy.linux_hardening` (`roles/linux_hardening/`)
  - `cx_ansible_galaxy.linux_auditing` (`roles/linux_auditing/`)
  - `cx_ansible_galaxy.linux_users` (`roles/linux_users/`)
  - `cx_ansible_galaxy.linux_selinux` (`roles/linux_selinux/`)
  - `firewall` (`roles/firewall/`) — vendored in this collection; resolves
    in-collection, no separate clone needed. Set
    `linux_security_apply_firewall: false` to skip it.

- Collections used by constituent roles: `ansible.posix`, `community.general`

## Variable contract

This role controls **which** constituent roles run; it does not duplicate their variable contracts. Set constituent role variables in inventory or playbook `vars:`.

| Variable | Default | Description |
|---|---|---|
| `linux_security_apply_packages` | `true` | Run `linux_packages` role |
| `linux_security_apply_hardening` | `true` | Run `linux_hardening` role |
| `linux_security_apply_firewall` | `true` | Run `firewall` role (requires `roles/firewall/` to exist) |
| `linux_security_apply_auditing` | `true` | Run `linux_auditing` role |
| `linux_security_apply_users` | `true` | Run `linux_users` role |
| `linux_security_apply_selinux` | `true` | Run `linux_selinux` role |

Constituent role variables (`linux_packages_*`, `linux_hardening_*`, etc.) are passed through unchanged — the orchestrator does not shadow them.

## Usage

```bash
# Apply all security domains to the rhel_targets group
ansible-playbook playbooks/linux_security.yml -l rhel_targets

# Apply all domains except firewall (e.g. firewall managed elsewhere)
ansible-playbook playbooks/linux_security.yml \
  -e linux_security_apply_firewall=false

# Hardening + auditing only
ansible-playbook playbooks/linux_security.yml \
  -e linux_security_apply_packages=false \
  -e linux_security_apply_firewall=false \
  -e linux_security_apply_users=false \
  -e linux_security_apply_selinux=false
```

## Testing

```bash
cd roles/linux_security && molecule test
```

Molecule runs against AlmaLinux 8, 9, 10 systemd containers. The converge skips `firewall` (`linux_security_apply_firewall: false`) since `roles/firewall` may not be cloned. Verify asserts that `audit` is installed (packages ran), `sshd_config` exists (hardening ran), audit rules are deployed, and `faillock.conf` is in place.

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | almalinux:8, almalinux:9, almalinux:latest | All assertions pass |

**Scenario: default** — validates the linux_security orchestrator chains all sub-roles:

| Sub-role invoked | What is tested |
|---|---|
| `linux_packages` | `audit` package installed |
| `linux_hardening` | `/etc/ssh/sshd_config` exists; sysctl apply skipped; empty kernel_modules list |
| `linux_auditing` | Audit rules deployed to `/etc/audit/rules.d/`; service start skipped (kernel audit not in containers) |
| `linux_users` | `/etc/security/faillock.conf` present with correct `deny` value |
| `linux_selinux` | Graceful skip when SELinux disabled in containers |
| `firewall` | Skipped (`linux_security_apply_firewall: false` — `roles/firewall` may not be cloned) |

### Bugfixes

- **BUG-102 (2026-07-12)**: unconditional `meta/main.yml` `dependencies:` ran
  all five domain roles before this role's tasks, defeating every `apply_*`
  gate (the task-level `when:` gates were always correct; meta dependencies
  ignore them and any caller `vars:`). Fixed with `dependencies: []` —
  conditional composition lives solely in the gated `include_role` calls.
  Verified: all-gates-false run executes zero sub-role tasks.

