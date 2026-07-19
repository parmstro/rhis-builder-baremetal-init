# linux_users

User account security policy for EL 8/9/10 — sudo access controls, account lockout via faillock, and optional uid/gid standards enforcement. Dispatcher driven by `linux_users_action`.

Namespace: `cx_ansible_galaxy`. Published as `cx_ansible_galaxy.linux_users`.
Orchestration repo: `../../` — playbooks, inventory, CI scripts, and full platform `CLAUDE.md` live there.

## Requirements

- Collections: `ansible.builtin`
- `sudo` must be installable (the role installs it if absent)
- `pam_faillock` is available from EL 8 onward (replaces `pam_tally2`)

## Variable contract

### Dispatcher

| Variable | Default | Description |
|---|---|---|
| `linux_users_action` | `all` | `sudo`, `faillock`, `uid_standards`, or `all` |

### Account lockout (`faillock` action)

| Variable | Default | Description |
|---|---|---|
| `linux_users_faillock_deny` | `5` | Lock after N consecutive failures |
| `linux_users_faillock_unlock_time` | `900` | Seconds before automatic unlock (0 = manual) |
| `linux_users_faillock_fail_interval` | `900` | Window (seconds) in which failures are counted |

### Sudo policy (`sudo` action)

| Variable | Default | Description |
|---|---|---|
| `linux_users_sudo_nopasswd_groups` | `[]` | Groups granted `NOPASSWD: ALL` sudo |
| `linux_users_sudo_nopasswd_users` | `[]` | Users granted `NOPASSWD: ALL` sudo |

Rendered to `/etc/sudoers.d/linux_users_groups` and `/etc/sudoers.d/linux_users_users` respectively. Both files are validated with `visudo -cf` before deployment.

### uid/gid standards (`uid_standards` action)

| Variable | Default | Description |
|---|---|---|
| `linux_users_uid_standards` | `[]` | List of `{name, uid, gid, groups, shell, comment}` dicts |

## Usage

```bash
# Configure all user security policies
ansible-playbook playbooks/linux_security.yml -e linux_users_action=all

# Faillock only (no sudo/uid changes)
ansible-playbook playbooks/linux_security.yml -e linux_users_action=faillock

# Grant a group passwordless sudo
ansible-playbook playbooks/linux_security.yml \
  -e linux_users_action=sudo \
  -e '{"linux_users_sudo_nopasswd_groups": ["wheel"]}'
```

## Testing

```bash
cd roles/linux_users && molecule test
```

Molecule runs against AlmaLinux 8, 9, 10 systemd containers. Converge applies the faillock action (sudo is a no-op with empty lists). Verify asserts `/etc/security/faillock.conf` exists with correct `deny` value and `sudo` is installed.

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | almalinux:8, almalinux:9, almalinux:latest | All assertions pass |

**Scenario: default** — exercises user security configuration:

| Test | What is verified |
|---|---|
| `faillock` action | `/etc/security/faillock.conf` created; `deny = 5` present; `unlock_time = 900` set |
| `sudo` action (empty lists) | No-op on empty `sudo_nopasswd_groups`/`sudo_nopasswd_users`; `sudo` package confirmed installed |

Actions requiring live user accounts (`uid_gid`, `all` with real users) are not exercised in molecule — they need managed users present on the host.
