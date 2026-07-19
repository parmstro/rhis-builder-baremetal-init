# pm_ansible

Pure-Ansible password lifecycle management. No external secret-management service required.
Use standalone or via `roles/password_management`.

## Standalone usage

```yaml
# Create a new service account password
- ansible.builtin.include_role:
    name: pm_ansible
  vars:
    pm_ansible_action: create
    pm_target: db_app_user
    pm_service: cmdb
    pm_length: 24
    pm_expiry_days: 90

# Rotate an existing credential
- ansible.builtin.include_role:
    name: pm_ansible
  vars:
    pm_ansible_action: rotate
    pm_target: db_app_user

# Audit ISM compliance for a credential
- ansible.builtin.include_role:
    name: pm_ansible
  vars:
    pm_ansible_action: audit
    pm_target: db_app_user
    pm_audit_report_format: json
```

## What it does

Manages passwords without any external secret-management dependency:
- Generates ISM-compliant passwords using `python3 secrets` (CSPRNG — `os.urandom`)
- Stores credentials in `pm_ansible_cred_dir` (default: `/root/.pm_credentials/`) with mode 0600
- Maintains an audit metadata file per target (creation date, expiry, ISM controls)
- Enforces ISM-0408 history by hashing and archiving the last `pm_history_count` passwords
- Optionally manages the OS system user account via `ansible.builtin.user`

## Files written per target

| File | Mode | Contents |
|---|---|---|
| `<target>.cred` | 0600 | Plaintext password (used by callers to configure services) |
| `<target>.meta.yml` | 0600 | Audit metadata: creation date, expiry, ISM controls |
| `<target>.history` | 0600 | SHA-512 hashes of last N passwords (ISM-0408 reuse check) |

## ISM-compliant password generation

Uses Python's `secrets` module (PEP 506, Python 3.6+):
```python
import secrets, string
chars = uppercase + lowercase + digits + special
# Regenerate until all four ISM-0407 character classes are satisfied
while True:
    pwd = ''.join(secrets.choice(chars) for _ in range(length))
    if all_classes_present(pwd):
        break
```

`secrets.choice()` uses `os.urandom()` — the same entropy source as OpenSSL's
`/dev/urandom`. This satisfies NIST SP 800-63B and ISM-0406/0407.

## Variables

All ISM policy variables (`pm_length`, `pm_expiry_days`, etc.) are inherited from
the dispatcher — including `pm_special_chars` (default
`!@#$%^&*()-_=+[]{}|;:,.<>?`), the charset used for the special-character class.
It is a normal role default, so a group_vars file for the target system
overrides it (e.g. `group_vars/<group>/vars.yml: pm_special_chars: "..."`) with
no code change — see `password_management`'s README **Per-target
special-character overrides** section. Role-specific variables:

| Variable | Default | Description |
|---|---|---|
| `pm_ansible_cred_dir` | `/root/.pm_credentials` | Credential store directory |
| `pm_ansible_manage_system_user` | `false` | Also set the OS user account password |
| `pm_ansible_system_user` | `{{ pm_target }}` | OS username to manage |
| `pm_ansible_user_shell` | `/sbin/nologin` | Shell for service accounts |
| `pm_ansible_python` | `python3` | Python interpreter for password generation |
| `pm_execute` | `true` | Shared family dry-run gate (also honoured by `pm_vault`/`pm_thycotic`) — set `false` to validate inputs without writing credentials. Used by `rhism.platform.builder`'s Phase 3.5 secrets dry-run. |

## Molecule test results

| Scenario | Platform | Result |
|---|---|---|
| `default` | AlmaLinux 9 container | PASS |

**Scenario: default** — full CRUD lifecycle on an EL9 container.

Tests run:
- `create` — generates ISM-compliant password (`secrets` module, all four character classes); writes credential, metadata, and history files to controller via `delegate_to: localhost`
- `audit` — reads credential metadata, asserts ISM-0406 length compliance, writes audit report
- `rotate` — generates a new password, enforces ISM-0408 history check (SHA-512 hash comparison), overwrites credential file
- `delete` — removes credential, metadata, and history files; locks system user if `pm_ansible_manage_system_user: true`

Notable fixes discovered during testing:
- `become: true` on `delegate_to: localhost` tasks fails in EE (non-root, no sudo) — use `pm_ansible_become` toggle (`false` in molecule, `true` in production)
- `strftime` argument order in Ansible is `'format' | strftime(epoch)` not `epoch | strftime('format')` (BUG-024)
- `hash('sha512')` not `password_hash('sha512')` for plain string comparison in history check
