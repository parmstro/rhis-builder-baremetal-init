# linux_selinux

SELinux policy management for EL 8/9/10 — enforcement mode, boolean management, and file context fixes. Gracefully skips all tasks when SELinux is absent (containers, VMs with SELinux disabled). Dispatcher driven by `linux_selinux_action`.

Namespace: `cx_ansible_galaxy`. Published as `cx_ansible_galaxy.linux_selinux`.
Orchestration repo: `../../` — playbooks, inventory, CI scripts, and full platform `CLAUDE.md` live there.

## Requirements

- Collections: `ansible.posix` (selinux module), `community.general` (seboolean, sefcontext modules)
- SELinux must be installed on the managed host; if `ansible_selinux.status == 'disabled'` the role logs a message and exits cleanly
- Changing from `disabled` to `enforcing`/`permissive` requires a reboot — the role sets the state but does not reboot

## Variable contract

### Dispatcher

| Variable | Default | Description |
|---|---|---|
| `linux_selinux_action` | `all` | `enforce`, `booleans`, `fcontexts`, or `all` |

### Enforcement mode (`enforce` action)

| Variable | Default | Description |
|---|---|---|
| `linux_selinux_state` | `enforcing` | `enforcing`, `permissive`, or `disabled` |
| `linux_selinux_policy` | `targeted` | SELinux policy type |

### Boolean management (`booleans` action)

| Variable | Default | Description |
|---|---|---|
| `linux_selinux_booleans` | `[]` | List of `{name, state, persistent}` dicts |

Example:
```yaml
linux_selinux_booleans:
  - name: httpd_can_network_connect
    state: "on"
    persistent: true
```

### File context management (`fcontexts` action)

| Variable | Default | Description |
|---|---|---|
| `linux_selinux_fcontexts` | `[]` | List of `{target, setype}` dicts |

After context assignment, `restorecon -Rv` runs on the target path.

Example:
```yaml
linux_selinux_fcontexts:
  - target: /srv/myapp(/.*)?
    setype: httpd_sys_content_t
```

## Usage

```bash
# Enforce SELinux on all managed hosts
ansible-playbook playbooks/linux_security.yml -e linux_selinux_action=enforce

# Set a boolean
ansible-playbook playbooks/linux_security.yml \
  -e linux_selinux_action=booleans \
  -e '{"linux_selinux_booleans": [{"name": "httpd_can_network_connect", "state": "on", "persistent": true}]}'
```

## Testing

```bash
cd roles/linux_selinux && molecule test
```

Molecule runs against AlmaLinux 8, 9, 10 systemd containers. SELinux is disabled inside containers — the role detects this and skips enforce/booleans/fcontexts tasks cleanly. Verify confirms `ansible_selinux` is defined and that the role completed without error. Full SELinux testing requires a real EL VM with SELinux installed.

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | almalinux:8, almalinux:9, almalinux:latest | Graceful skip verified |

**Scenario: default** — confirms correct behaviour when SELinux is unavailable (containers):

| Test | What is verified |
|---|---|
| `all` action (EL8) | `ansible_selinux` fact gathered; role completes without error; SELinux disabled → all sub-tasks skipped |
| `all` action (EL9) | Same graceful skip on EL9 |
| `all` action (EL10) | Same graceful skip on EL10 |

Full policy enforcement (`state: enforcing`, booleans, fcontexts) requires a real EL VM with `selinux-policy` installed — container kernels do not expose the SELinux subsystem independently.
