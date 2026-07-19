# pm_vault

HashiCorp Vault lifecycle management role — server deployment AND secret management.

## Actions

### Server lifecycle

| `pm_vault_action` | Description |
|---|---|
| `install` | Install Vault from HashiCorp repo, create user/dirs, render config, open firewall ports 8200/8201 |
| `configure` | Init Vault, unseal, enable KV v2, enable AppRole auth, write ISM-aligned policy |
| `start` | Start the vault systemd service |
| `stop` | Stop the vault systemd service |
| `remove` | Uninstall Vault package and repo; set `pm_vault_purge_data: true` to also remove data |
| `baseline` | Orchestrate: install → start → configure |

### Secret management

| `pm_vault_action` | Description |
|---|---|
| `create` | Generate ISM-compliant password, store in Vault KV with ISM metadata |
| `read` | Retrieve a secret from Vault KV into `pm_result.password` |
| `delete` | Destroy a KV secret (all versions for KV v2) |
| `audit` | Read KV metadata, check expiry, write ISM compliance report |
| `rotate` | Generate new password, write as a new KV version (history preserved natively) |

Secret actions honour `pm_execute` (default `true`, shared family dry-run gate — also honoured by
`pm_ansible`/`pm_thycotic`): set `false` to validate inputs and skip the actual Vault dispatch.
Used by `rhism.platform.builder`'s Phase 3.5 secrets dry-run.

## ISM-0408 via KV v2 versioning

Vault KV v2 retains full version history. Each `rotate` writes a new version; Vault
stores the previous N versions automatically. Set `max_versions` on the KV mount to
enforce the reuse window matching `pm_history_count`.

## Password policy variables

`create`/`rotate` generate via the shared ISM-compliant generator (see
`password_management`'s README **ISM control mapping**): `pm_length`,
`pm_min_uppercase/lowercase/digits/special`, and `pm_special_chars` (default
`!@#$%^&*()-_=+[]{}|;:,.<>?` — the charset for the special-character class).
`pm_special_chars` is a normal role default, so a group_vars file for the
target system overrides it with no code change — see `password_management`'s
README **Per-target special-character overrides** section.

## Firewall

`install` calls `include_role: name: firewall` (controlled by `pm_vault_apply_firewall: true`).
Firewall policy is defined entirely in inventory — the role never hardcodes zones, sources,
or interfaces. Add the following to your vault server group_vars:

```yaml
# group_vars/vault_servers/vars.yml
firewall:
  - zone: public
    ports:
      - "8200/tcp"   # Vault HTTP API and UI
      - "8201/tcp"   # Vault cluster (Raft / replication)
    source:
    masquerade: false
```

Set `pm_vault_apply_firewall: false` in molecule scenarios and on hosts that use
`iptables` directly instead of firewalld.

## Vault configuration template

`templates/vault.hcl.j2` renders `/etc/vault.d/vault.hcl` with:
- Storage: **Raft** (integrated, no Consul dependency) or Consul
- Listener: TLS 1.2+ (or `tls_disable: true` for dev/lab)
- API + cluster addresses derived from `ansible_default_ipv4.address`

## Init output

`configure` writes `pm_vault_init_output_path` (default: `/root/.vault_init.json`)
containing unseal keys and root token. **Protect this file with Ansible Vault.**

## Standalone usage

```yaml
# Deploy a new Vault server end-to-end
- hosts: vault_servers
  roles:
    - role: pm_vault
      vars:
        pm_vault_action: baseline
        pm_vault_tls_enabled: false   # set to true + supply certs for production

# Write a password to Vault KV
- hosts: localhost
  tasks:
    - ansible.builtin.include_role:
        name: pm_vault
      vars:
        pm_vault_action: create
        pm_target: db_app_user
        pm_vault_url: "https://vault.example.com:8200"
        pm_vault_auth_method: approle
        pm_vault_role_id: "{{ vault_approle_role_id }}"
        pm_vault_secret_id: "{{ vault_approle_secret_id }}"

# Read a password back
- hosts: app_servers
  tasks:
    - ansible.builtin.include_role:
        name: pm_vault
      vars:
        pm_vault_action: read
        pm_target: db_app_user
        pm_vault_url: "https://vault.example.com:8200"
        pm_vault_auth_method: approle
        pm_vault_role_id: "{{ vault_approle_role_id }}"
        pm_vault_secret_id: "{{ vault_approle_secret_id }}"
      no_log: true
    # pm_result.password is now available
```

## Auth methods

| Method | Variables required | When to use |
|---|---|---|
| `approle` (default) | `pm_vault_role_id`, `pm_vault_secret_id` | Automated playbooks — ISM-1416 compliant |
| `token` | `pm_vault_token` | Ad-hoc / debugging only |
| `ldap` | `pm_vault_ldap_username`, `pm_vault_ldap_password` | Directory-integrated |
| `jwt` | `pm_vault_jwt`, `pm_vault_jwt_role` | CI/CD OIDC |

## Collections required

- `community.hashi_vault` — all secret management operations
- `ansible.posix` — firewalld rules
Both are in the base EE via `roles/execution_environment`.

## Molecule test results

| Scenario | Platform | Result |
|---|---|---|
| `default` | `hashicorp/vault:latest` dev container | PASS |
| `server` | AlmaLinux 9 container | PASS |

**Scenario: default** — all KV secret operations against a live Vault dev server.

Tests run:
- `create` — stores ISM-compliant password in KV v2 with metadata (service, length, expiry, ISM controls)
- `read` — retrieves and exposes password as `pm_result`
- `audit` — reads KV metadata, calculates password age, checks ISM-0410 expiry, writes audit report
- `rotate` — writes new password version to KV; version history preserved
- `delete` — soft-deletes current version; verify confirms 404 on data read and ≥2 versions in metadata history

**Scenario: server** — Vault binary installation and service management on EL9.

Tests run:
- Vault installed from HashiCorp repo
- Config written (Raft storage, TLS, listener)
- Service managed via `pm_vault_manage_service` toggle

Notable fixes discovered during testing:
- `community.hashi_vault` v7 breaking changes (BUG-027): module renames (`vault_kv_put` → `vault_kv2_write` etc.), `mount_point` → `engine_mount_point`, response path changed to `raw.data.data.*`
- Handlers fire unconditionally when notified even if the notifying task has a `when:` condition — add `when: pm_vault_manage_service | bool` to handlers (BUG-026)
- Vault binary has `cap_ipc_lock+ep` set; executing `vault version` inside a container without `IPC_LOCK` capability fails with EPERM — use `stat /usr/bin/vault` to verify installation, add `capabilities: [IPC_LOCK]` to molecule platform
- Missing `driver: name: docker` block causes molecule to use the delegated driver and never create containers (BUG-028)
