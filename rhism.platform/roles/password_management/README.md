# password_management

ISM-aligned password lifecycle management role. Dispatches to one of three backends:

| Backend | Role | Description |
|---|---|---|
| `ansible` | `pm_ansible` | Pure Ansible — generates locally, stores in encrypted credential files |
| `vault` | `pm_vault` | HashiCorp Vault KV v2 via `community.hashi_vault` |
| `thycotic` | `pm_thycotic` | Delinea/Thycotic Secret Server via `delinea.tss` |

## Actions

| `pm_action` | Description |
|---|---|
| `create` | Generate ISM-compliant password, store in backend, record metadata |
| `delete` | Remove/retire password from backend |
| `audit` | Check password age, complexity, and history against ISM controls |
| `rotate` | Generate new password, update backend, retain history |

## ISM control mapping

| Variable | ISM Control | Default | Requirement |
|---|---|---|---|
| `pm_length` | ISM-0406 | 20 | Minimum 12 characters |
| `pm_min_uppercase/lowercase/digits/special` | ISM-0407 | 1 each | All four character classes |
| `pm_special_chars` | ISM-0407 | `!@#$%^&*()-_=+[]{}\|;:,.<>?` | Charset used for the "special" character class — see **Per-target special-character overrides** below |
| `pm_expiry_days` | ISM-0410 | 90 | 90 days (privileged); 180 days (standard) |
| `pm_history_count` | ISM-0408 | 5 | Last 5 passwords cannot be reused |
| `pm_max_attempts` | ISM-0411 | 5 | Lock after 5 consecutive failures |
| `pm_lockout_minutes` | ISM-0411 | 30 | 30-minute lockout duration |
| `pm_first_login_change` | ISM-0412 | true | Initial password expires on first login |

## Per-target special-character overrides

Special-character constraints vary by the system that ultimately consumes the
generated password (some device/product CLIs mishandle certain punctuation).
`pm_special_chars` is a normal role default (not an internal `vars/`), so it
follows standard Ansible precedence — override it per target-system group
without touching any role code:

```yaml
# group_vars/<target-group>/vars.yml
pm_special_chars: "!@#%^&*()-_=+"
```

All three backend roles (`pm_ansible`/`pm_vault`/`pm_thycotic`) read
`pm_special_chars` and pass it to the generator via `environment:` (not
string-interpolated into the generator script), so overrides may safely
include any character — including quotes or backslashes — without breaking
generation.

As of this writing, no product role in this platform generates a
device-bound password against a specific target system with a documented
narrower special-character allowlist than the universal default above — every
current product role (Arista, FreeIPA/IdM, Windows) accepts an
externally-supplied `*_password` rather than generating one. `pm_special_chars`
exists so a future product-role integration (or a `pm_target`-scoped account
tied to such a system) can override the charset per group without any code
change.

## Password generation — why only `python3 secrets`

Several common Ansible patterns are **NOT ISM-compliant**:

| Method | Issue |
|---|---|
| `lookup('password', '/tmp/file')` | Writes plaintext to controller filesystem |
| `{{ 99999 \| random \| string }}` | Uses Python `random` (Mersenne Twister) — not a CSPRNG |
| `lookup('community.general.random_string')` | Uses `random.SystemRandom` — acceptable but not explicitly documented as CSPRNG |

This role uses `python3 -c "import secrets; ..."` (Python 3.6+ `secrets` module), which is explicitly backed by `os.urandom()` / `/dev/urandom` and is recommended by NIST SP 800-63B for credential generation. All four ISM-0407 character classes are enforced by post-generation validation before the password is stored.

## Usage

```yaml
# Create a new service account password via pure Ansible
- ansible.builtin.include_role:
    name: password_management
  vars:
    pm_action: create
    pm_type: ansible
    pm_target: db_app_user
    pm_service: cmdb
    pm_length: 24

# Rotate a secret in HashiCorp Vault
- ansible.builtin.include_role:
    name: password_management
  vars:
    pm_action: rotate
    pm_type: vault
    pm_target: db_app_user
    pm_vault_url: "https://vault.example.com:8200"
    pm_vault_auth_method: approle
    pm_vault_role_id: "{{ vault_approle_role_id }}"
    pm_vault_secret_id: "{{ vault_approle_secret_id }}"
    pm_vault_path: "services/cmdb/db_app_user"

# Audit all Thycotic secrets for ISM compliance
- ansible.builtin.include_role:
    name: password_management
  vars:
    pm_action: audit
    pm_type: thycotic
    pm_target: db_app_user
    pm_tss_server_url: "https://secretserver.example.com"
    pm_tss_username: "{{ vault_tss_username }}"
    pm_tss_password: "{{ vault_tss_password }}"
    pm_tss_secret_id: 42
```

## Result variable

After `create` or `rotate`, the generated password is available as `pm_result.password`.
Always use `no_log: true` on tasks that reference this variable. The password is
never written to Ansible logs regardless (product roles set `no_log: true` internally).

## Requirements

- EE must include `community.hashi_vault` (for `vault` backend) and `delinea.tss` (for `thycotic` backend)
- Both are added to the base EE by `roles/execution_environment`
- `python3` with `secrets` module must be available on the controller (standard in Python 3.6+)

## Dry-run

`pm_execute` (default `true`) is honoured by all three backend roles — set `false` to validate
inputs and routing without writing credentials or calling a real Vault/TSS backend. It flows
through this dispatcher's `include_role` unchanged (not declared in `vars/main.yml`, so normal
Ansible scoping passes the caller's value straight to the backend role). Used by
`rhism.platform.builder`'s Phase 3.5 secrets dry-run.

## Molecule test results

| Scenario | Platform | Result |
|---|---|---|
| `default` | AlmaLinux 9 container (`pm_ansible` backend) | PASS |

**Scenario: default** — dispatcher role exercised end-to-end against the `pm_ansible` backend (no external dependencies required).

Tests run:
- `create` → `pm_ansible` backend; confirms `pm_result.password` set, length ≥ 20, `backend: ansible`
- `audit` → report written via dispatcher chain
- `rotate` → new password generated and confirmed via `pm_result`
- `delete` → credential files removed via dispatcher

All four actions validated through the dispatcher (`pm_type: ansible`) to confirm correct routing to `pm_ansible` product role.
