# rh_idm

## Description

Deploys and manages a subscription [Red Hat Identity Management](https://access.redhat.com/products/identity-management)
(IdM) domain: server or replica install, client enrolment, host keytabs, Active Directory
trusts, and management of DNS zones/records, users, groups, HBAC rules and sudo rules. Red Hat
IdM is the supported, subscription build of FreeIPA — integrated Kerberos, LDAP, CA and DNS —
running on the RHEL `ipa-server` packages, with RHSM registration and the `idm:DL1` module
stream enabled before install.

This is one of two identity **product roles** — `rh_idm` (subscription Red Hat IdM) and
`freeipa` (open source). It is **standalone-first** — runnable directly in a playbook — and is
also **selected by the `identity_management` dispatcher** when `idm_type: rh_idm`. Both
products consume the **same variable interface** (bare `action` plus the `idm_*` vars), so the
dispatcher selects either with one identical call and no per-product code. Pick `rh_idm` when
you have an active Red Hat subscription and want supported IdM; pick `freeipa` otherwise.

## Requirements

- Ansible: 2.15+ · Collections: `freeipa.ansible_freeipa`, `ansible.posix` (firewalld),
  `community.general` (RHSM)
- A RHEL 9 host with an active Red Hat subscription (`idm_rhsm_org_id` +
  `idm_rhsm_activation_key`, unless `idm_rhsm_skip_registration: true`)
- `idm_admin_password` and `idm_ds_password` (vault) for a real server install
- Server/replica/client install actions are gated (`idm_server_install`,
  `idm_replica_install`, `idm_client_install`) — dry-run until set `true`

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `server` | `server` · `replica` · `client` · `enroll` · `trust` · `dns` · `user` · `group` · `hbac` · `sudo` · `otp` · `smart_card` · `radius_proxy` · `present`/`absent` (packages) · `started`/`stopped`/`restarted` (service). Shared across identity products. |
| `idm_domain` | `""` | Kerberos/DNS domain, e.g. `corp.example.com`. Shared interface var. |
| `idm_realm` | `""` | Kerberos realm; derived as uppercase domain when empty. |
| `idm_hostname` | `""` | Server FQDN; defaults to `inventory_hostname`. |
| `idm_server_install` | `false` | Execute gate for `action: server` — `false` = dry-run. |
| `idm_replica_install` | `false` | Execute gate for `action: replica` — `false` = dry-run. |
| `idm_client_install` | `false` | Execute gate for `action: client` — `false` = dry-run. |
| `idm_rhsm_org_id` | `""` | RHSM organization ID (vault). rh_idm-specific. |
| `idm_rhsm_activation_key` | `""` | RHSM activation key (vault). rh_idm-specific. |
| `idm_rhsm_skip_registration` | `false` | Skip RHSM registration (host already registered). |
| `idm_admin_password` | `""` | Admin Kerberos principal password (vault). |
| `idm_ds_password` | `""` | Directory Server (LDAP) password (vault). |
| `idm_setup_dns` | `true` | Configure integrated BIND DNS on install. |
| `idm_forwarders` | `[]` | Explicit DNS forwarders. |
| `idm_idstart` / `idm_idmax` | `100000` / `199999` | UID/GID range for IdM-managed users; idstart must exceed `/etc/login.defs` UID_MAX (60000 on EL — BUG-115). |
| `idm_manage_firewall` | `true` | Open IdM service ports via firewalld during server/replica prepare; disable where no firewalld runs (containers, externally-managed firewalls). |
| `idm_master_server` | `""` | Existing server to replicate from (`action: replica`). |
| `idm_server_hostname` | `""` | IdM server to enroll clients with (`action: client`/`enroll`). |
| `idm_trust_type` / `idm_ad_trust_domain` / `idm_ad_trust_admin` | `ad` / `""` / `Administrator` | AD trust settings (`action: trust`). |
| `idm_dns_zones` / `idm_dns_records` | `[]` / `[]` | DNS objects (`action: dns`). |
| `idm_users` / `idm_groups` / `idm_hbac_rules` / `idm_sudo_rules` | `[]` | Directory objects (`action: user`/`group`/`hbac`/`sudo`). |
| `idm_otp_tokens` | `[]` | TOTP/HOTP token definitions to provision and bind to users (`action: otp`). |
| `idm_smart_card_ca_cert` / `idm_smart_card_ca_cert_file` | `""` | Smart card CA cert content/path for PIV/CAC/YubiKey auth (`action: smart_card`). |
| `idm_radius_servers` / `idm_radius_user_mappings` | `[]` | RADIUS proxy server registrations and per-user server mappings (`action: radius_proxy`). |

Full interface is declared and validated in `meta/argument_specs.yml`.

## Use Cases

**Standalone — install a Red Hat IdM server** (set the gate `true` for a real install):

```yaml
- hosts: idm_servers
  roles:
    - role: rh_idm
      vars:
        action: server
        idm_domain: corp.example.com
        idm_rhsm_org_id: "{{ vault_rhsm_org_id }}"
        idm_rhsm_activation_key: "{{ vault_rhsm_key }}"
        idm_admin_password: "{{ vault_idm_admin_password }}"
        idm_ds_password: "{{ vault_idm_ds_password }}"
        idm_server_install: true
```

**Standalone — enroll a client** (host already RHSM-registered):

```yaml
- hosts: linux_hosts
  roles:
    - role: rh_idm
      vars:
        action: client
        idm_domain: corp.example.com
        idm_server_hostname: idm1.corp.example.com
        idm_admin_password: "{{ vault_idm_admin_password }}"
        idm_rhsm_skip_registration: true
        idm_client_install: true
```

**Standalone — manage HBAC rules:**

```yaml
- hosts: idm1.corp.example.com
  roles:
    - role: rh_idm
      vars:
        action: hbac
        idm_admin_password: "{{ vault_idm_admin_password }}"
        idm_hbac_rules:
          - { name: allow_admins, usercategory: all, hostcategory: all }
```

**Via the `identity_management` dispatcher** (same code selects either product):

```yaml
- hosts: idm_servers
  roles:
    - role: identity_management
      vars:
        idm_action: server
        idm_type: rh_idm
        idm_domain: corp.example.com
        idm_server_install: true
```

## Testing

```bash
cd roles/rh_idm && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with the install gates `false`, so it
validates argument-spec enforcement, action dispatch, the shared variable contract, and the
negative (bad-action) path without touching a real IdM domain or RHSM. A real Red Hat IdM
deployment requires a subscribed RHEL 9 host and is exercised in the full-stack test lab, not
in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

- **BUG-114 (2026-07-12)** — `action: server` called the ansible_freeipa
  `ipaserver` *topology* module with install parameters; it can't install
  anything, so the flagship action never could deploy a server (same defect
  in the freeipa sibling, where the functional scenario surfaced it). Refit
  to the collection's `ipaserver` **role** (`idm_*` → `ipaserver_*` mapping).
- **BUG-115 (2026-07-12)** — default `idm_idstart: 50000` fails IdM install
  validation on EL (`/etc/login.defs` UID_MAX 60000); raised to `100000`.

## Support / License

Platforms: RHEL 9 (subscription required). License: MIT.

## Related Information

- Depth doc: [`docs/rh_idm.md`](../../docs/rh_idm.md) — internals, action workflows, RHSM
  registration, gates, permutations, and gotchas.
- Family index: [`docs/identity-management.md`](../../docs/identity-management.md) — the
  identity product family and the shared `idm_*` interface.
- Sibling product: `freeipa` (open source, same interface).
- Dispatcher: `identity_management` (`idm_type: rh_idm`).
