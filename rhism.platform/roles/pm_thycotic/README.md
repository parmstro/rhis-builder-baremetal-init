# pm_thycotic

Delinea/Thycotic Secret Server password management role. Standalone or callable via `roles/password_management`.

Uses the `delinea.tss` collection (REST API). Passwords are generated locally with `python3 secrets`
(ISM-compliant) before being pushed to TSS — ensuring ISM-0406/0407 character policy is met regardless
of the TSS template's own generation settings.

## Actions

| `pm_thycotic_action` | Description |
|---|---|
| `create` | Generate ISM password, create new secret in TSS folder |
| `delete` | Retire secret (soft-delete — preserves TSS audit trail) |
| `audit` | Fetch metadata, check active status, write ISM compliance report |
| `rotate` | Generate new password, update existing secret by ID |

## TSS audit trail

Secret Server provides a native audit trail for all secret access and changes.
The `delinea.tss` collection calls the REST API over HTTPS — all operations appear
in TSS's built-in Secret Audit Log. No separate audit configuration is required.

ISM-0408 (password history) is enforced by TSS's built-in password history settings
configured in the Secret Template.

## Standalone usage

```yaml
# Create a new secret
- ansible.builtin.include_role:
    name: pm_thycotic
  vars:
    pm_thycotic_action: create
    pm_target: db_app_user
    pm_service: cmdb
    pm_thycotic_server_url: "https://secretserver.example.com"
    pm_thycotic_username: "{{ vault_tss_username }}"
    pm_thycotic_password: "{{ vault_tss_password }}"
    pm_thycotic_folder_id: "42"
    pm_thycotic_template_id: "6003"

# Rotate an existing secret by ID
- ansible.builtin.include_role:
    name: pm_thycotic
  vars:
    pm_thycotic_action: rotate
    pm_target: db_app_user
    pm_thycotic_server_url: "https://secretserver.example.com"
    pm_thycotic_username: "{{ vault_tss_username }}"
    pm_thycotic_password: "{{ vault_tss_password }}"
    pm_thycotic_secret_id: "1234"
```

## Variables

| Variable | Default | Description |
|---|---|---|
| `pm_thycotic_action` | `""` | Action: create, delete, audit, rotate |
| `pm_thycotic_server_url` | `""` | TSS server URL — required |
| `pm_thycotic_username` | `""` | TSS service account — required |
| `pm_thycotic_password` | `""` | TSS password — set via vault |
| `pm_thycotic_domain` | `""` | AD domain for domain auth |
| `pm_thycotic_folder_id` | `""` | Target folder ID (create only) |
| `pm_thycotic_template_id` | `""` | Secret template ID (create only) |
| `pm_thycotic_secret_id` | `""` | Existing secret ID (delete/audit/rotate) |
| `pm_execute` | `true` | Shared family dry-run gate (also honoured by `pm_ansible`/`pm_vault`) — set `false` to force `pm_thycotic_skip_api: true` (validates inputs, skips real TSS calls). Used by `rhism.platform.builder`'s Phase 3.5 secrets dry-run. |

Local password generation (before pushing to TSS) also inherits the shared ISM
policy variables from the dispatcher — `pm_length`,
`pm_min_uppercase/lowercase/digits/special`, and `pm_special_chars` (default
`!@#$%^&*()-_=+[]{}|;:,.<>?` — the charset for the special-character class).
`pm_special_chars` is a normal role default, so a group_vars file for the
target system overrides it with no code change — see `password_management`'s
README **Per-target special-character overrides** section.

## Collection requirement

Requires `delinea.tss` — included in the base EE via `roles/execution_environment`.

> Note: The collection was previously named `thycotic.tss` before the Delinea rebrand (2021).
> `delinea.tss` is the actively maintained version on Ansible Galaxy.

## Molecule test results

| Scenario | Platform | Result |
|---|---|---|
| `default` | AlmaLinux 9 container (skip_api mode) | PASS |

**Scenario: default** — local ISM-compliant generation and dispatcher flow; TSS API calls skipped via `pm_thycotic_skip_api: true`. Integration tests against a real Thycotic/Delinea Secret Server must be run separately on a test environment with TSS access.

Tests run:
- `create` — generates ISM-compliant password locally; confirms `pm_result` populated with `backend: thycotic`
- `audit` — dry-run report generated without TSS fetch
- `rotate` — new ISM-compliant password generated; asserts all four character classes present (uppercase, lowercase, digit, special)
- `delete` — dispatcher invoked in skip_api mode

Notable fixes discovered during testing:
- `delinea.tss` module FQCN is resolved at parse time even for `when: false` tasks in the same file — TSS calls must be extracted to separate `tss_*.yml` files loaded via `include_tasks` with `when: not pm_thycotic_skip_api` so the file is never loaded when skipping (BUG-029)
- `| regex_search()` returns a string in ansible-core 2.19+, not a bool; `assert that:` conditionals must use `is regex()` instead (BUG-030)
