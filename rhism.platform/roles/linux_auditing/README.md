# linux_auditing

Auditd configuration for EL 8/9/10 — installs the audit package, deploys a CIS/STIG-aligned ruleset, configures `auditd.conf`, and manages the auditd service. Dispatcher driven by `linux_auditing_action`.

Namespace: `cx_ansible_galaxy`. Published as `cx_ansible_galaxy.linux_auditing`.
Orchestration repo: `../../` — playbooks, inventory, CI scripts, and full platform `CLAUDE.md` live there.

## Requirements

- Collections: `ansible.builtin`
- The role installs the `audit` package if not already present

## Variable contract

| Variable | Default | Description |
|---|---|---|
| `linux_auditing_action` | `configure` | Dispatcher: currently only `configure` |
| `linux_auditing_log_size` | `8192` | `max_log_file` in auditd.conf (KB) |
| `linux_auditing_num_logs` | `5` | `num_logs` in auditd.conf |
| `linux_auditing_space_left_action` | `SYSLOG` | `space_left_action` in auditd.conf |
| `linux_auditing_rules_extra` | `[]` | Additional raw rule strings appended after the baseline ruleset |

The baseline ruleset covers (per CIS/STIG): time-change, identity, system-locale, login/logout, session, DAC changes, unsuccessful file access, privileged commands, kernel module load/unload, and sudoers watches. The `-e 2` immutable flag is present but commented out — uncomment when rules are stable.

## Usage

```bash
# Configure auditd
ansible-playbook playbooks/linux_security.yml -e linux_auditing_action=configure

# Add custom rules on top of the baseline
ansible-playbook playbooks/linux_security.yml \
  -e linux_auditing_action=configure \
  -e '{"linux_auditing_rules_extra": ["-a always,exit -F arch=b64 -S open -F path=/etc/passwd -F perm=r"]}'
```

## Testing

```bash
cd roles/linux_auditing && molecule test
```

Molecule runs against AlmaLinux 9 and 10 systemd containers (`linux_auditing_start_service: false` — auditd cannot start in containers as the kernel audit subsystem is not independently accessible).

## Molecule test results

| Scenario | Platforms | Status |
|---|---|---|
| default | EL9, EL10 | All actions pass |

**Scenario: default** — exercises all 4 actions in sequence on each platform:

- `configure` — installs audit package, deploys `/etc/audit/rules.d/linux_auditing.rules` with CIS/STIG rule set, configures auditd.conf log rotation
- `verify` — asserts rules file exists with expected keys (sudoers, identity, time-change, privileged, modules); records `linux_auditing_verify_result` fact
- `report` — placeholder in container mode; records `linux_auditing_report` fact (aureport runs on real hosts)
- `baseline` — runs configure → verify → report in sequence; all three result facts set

Extra rules via `linux_auditing_rules_extra: ["-w /etc/cron.d -p wa -k cron"]` verified present in deployed file.
