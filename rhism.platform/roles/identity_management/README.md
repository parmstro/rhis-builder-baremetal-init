# identity_management

Ansible role for deploying and managing identity services across three backends:
FreeIPA, Red Hat IdM (IDM), and Active Directory integration via `realmd`/SSSD.

Follows the same **dispatcher + type-driven vars** pattern as `vm_provisioning` and
`awx_config` in this repo.

## Actions

| `idm_action` | Description |
|---|---|
| `server` | Install and configure a new IdM/FreeIPA server |
| `replica` | Add a replica to an existing IPA domain |
| `client` | Enroll a RHEL host as an IPA client |
| `enroll` | Join a RHEL host to an Active Directory domain (`realmd`) |
| `trust` | Establish a cross-forest trust between IPA and AD |
| `dns` | Manage DNS zones and records via IPA API |
| `otp` | Provision TOTP/HOTP tokens and bind to users |
| `smart_card` | Configure PIV/smart card auth (YubiKey, CAC, standard PIV) |
| `radius_proxy` | Register RADIUS proxy servers (RSA SecurID, Thales SafeNet, YubiKey OTP, generic) |
| `baseline` | Run a selected subset of actions gated by boolean toggles |

## Types

| `idm_type` | Backend |
|---|---|
| `freeipa` | Open-source FreeIPA (`freeipa-server`) |
| `rh_idm` | Red Hat IdM (DL1 module stream, RHSM subscription required) |
| `ad_integration` | Active Directory join only (no IPA server installed) — use `idm_action: enroll` |

## Requirements

- Ansible Core 2.14+
- `freeipa.ansible_freeipa` collection (server / client / OTP / smart card / RADIUS / trust / DNS actions)
- `community.general` collection (`redhat_subscription` for `rh_idm` type)
- `ansible.posix` collection (firewalld management)
- `community.crypto` collection (TLS certificate operations)

Install via:
```bash
ansible-galaxy collection install freeipa.ansible_freeipa community.general ansible.posix community.crypto
```

Or use the project EE: `ansible_galaxy_idm_ee:latest` (built by `bin/identity-management-ci.sh`).

## Key variables

### Common

| Variable | Default | Description |
|---|---|---|
| `idm_action` | `baseline` | Action to perform |
| `idm_type` | `freeipa` | Identity backend |
| `idm_domain` | — | **Required.** DNS domain for the IPA realm (e.g. `corp.example.com`) |
| `idm_realm` | derived | Kerberos realm (defaults to `idm_domain | upper`) |
| `idm_hostname` | `ansible_fqdn` | FQDN of the IdM server being configured |

### Server install

| Variable | Default | Description |
|---|---|---|
| `idm_admin_password` | — | IPA admin password (vault-backed, `no_log`) |
| `idm_ds_password` | — | Directory Services (389-ds) password (vault-backed, `no_log`) |
| `idm_server_install` | `false` | **Gate.** Set `true` to perform actual install. Default is dry-run. |
| `idm_setup_dns` | `true` | Configure IPA-integrated DNS |
| `idm_auto_forwarders` | `false` | Auto-detect forwarders from `/etc/resolv.conf` |
| `idm_forwarders` | `[]` | Explicit DNS forwarder list |
| `idm_no_forwarders` | `false` | Disable all forwarders (root hints) |
| `idm_ip_addresses` | `[]` | Explicit server IP(s) |
| `idm_idstart` | `50000` | Start of UID/GID range |
| `idm_idmax` | `199999` | End of UID/GID range |
| `idm_mkhomedir` | `true` | Auto-create home dirs on first login |

### RHSM (rh_idm type only)

| Variable | Default | Description |
|---|---|---|
| `idm_rhsm_org_id` | — | RHSM organization ID |
| `idm_rhsm_activation_key` | — | RHSM activation key (no_log) |
| `idm_rhsm_skip_registration` | `false` | Skip RHSM if host already registered |

### Replica

| Variable | Default | Description |
|---|---|---|
| `idm_master_server` | — | FQDN of the primary IPA server |
| `idm_replica_setup_dns` | `true` | Enable DNS on replica |
| `idm_replica_setup_ca` | `true` | Enable CA on replica |

### Client

| Variable | Default | Description |
|---|---|---|
| `idm_server_hostname` | — | FQDN of the IPA server to join |
| `idm_client_install` | `false` | **Gate.** Set `true` to run `ipa-client-install`. |

### AD enrollment (ad_integration)

| Variable | Default | Description |
|---|---|---|
| `idm_ad_admin_user` | `Administrator` | AD user with join rights |
| `idm_ad_admin_password` | — | AD join password (no_log, piped via stdin) |
| `idm_ad_computer_ou` | `''` | Target OU for the computer account |
| `idm_ad_permit_all_users` | `true` | Run `realm permit --all` after join |
| `idm_ad_enroll_execute` | `false` | **Gate.** Set `true` to run `realm join`. |

### Trust (IPA ↔ AD)

| Variable | Default | Description |
|---|---|---|
| `idm_ad_trust_domain` | — | AD domain to trust |
| `idm_ad_trust_admin` | `Administrator` | AD admin for trust |
| `idm_ad_trust_password` | — | AD admin password (no_log) |
| `idm_ad_trust_range_type` | `ipa-ad-trust` | ID range type |

### DNS

| Variable | Default | Description |
|---|---|---|
| `idm_dns_zones` | `[]` | List of `{name, forward_policy, forwarders}` zone dicts |
| `idm_dns_records` | `[]` | List of `{zone, name, type, value}` record dicts |

### OTP tokens

```yaml
idm_otp_tokens:
  - owner: jsmith
    type: totp               # totp | hotp
    description: "YubiKey TOTP"
    name: jsmith-yk-totp     # optional
    clock_offset: 0
    sync_window: 2
```

### Smart card / PIV

| Variable | Default | Description |
|---|---|---|
| `idm_smart_card_ca_cert` | `''` | PEM CA certificate string |
| `idm_smart_card_ca_cert_file` | `''` | Path to PEM CA cert file (slurped) |
| `idm_smart_card_server_configure` | `true` | Run `ipa-advise` server config |
| `idm_smart_card_configure_clients` | `false` | Push client config |
| `idm_smart_card_password_fallback` | `true` | Allow password as fallback |
| `idm_smart_card_required_users` | `[]` | Usernames to force smart card auth |
| `idm_smart_card_cert_map_rules` | `[]` | `{name, description, maprule, priority}` dicts |

Supports YubiKey (PIV mode), DoD CAC, and any standard PIV token via `pcscd`.

### RADIUS proxy

```yaml
idm_radius_servers:
  - name: rsa-primary
    server: rsa.corp.example.com
    secret: "{{ vault_rsa_secret }}"     # no_log
    port: 1812
    type: rsa          # rsa | safenet | yubikey | generic
  - name: yk-cloud
    server: radius.yubico.com
    secret: "{{ vault_yk_secret }}"
    port: 1812
    type: yubikey

idm_radius_user_mappings:
  - username: jsmith
    radius_proxy: rsa-primary
```

### Baseline toggles

| Variable | Default | Description |
|---|---|---|
| `idm_apply_server` | `false` | Include server action |
| `idm_apply_client` | `false` | Include client action |
| `idm_apply_dns` | `false` | Include DNS action |
| `idm_apply_trust` | `false` | Include trust action |
| `idm_apply_otp` | `false` | Include OTP action |
| `idm_apply_smart_card` | `false` | Include smart card action |
| `idm_apply_radius_proxy` | `false` | Include RADIUS proxy action |

## Usage examples

### FreeIPA server install (dry-run)

```yaml
- hosts: idm_servers
  roles:
    - role: identity_management
      vars:
        idm_action: server
        idm_type: freeipa
        idm_domain: corp.example.com
        idm_admin_password: "{{ vault_idm_admin_pw }}"
        idm_ds_password: "{{ vault_idm_ds_pw }}"
        idm_server_install: false    # dry-run; set true to install
        idm_setup_dns: true
        idm_forwarders:
          - 8.8.8.8
```

### Red Hat IdM server (with RHSM)

```yaml
- hosts: idm_servers
  roles:
    - role: identity_management
      vars:
        idm_action: server
        idm_type: rh_idm
        idm_domain: corp.example.com
        idm_rhsm_org_id: "{{ vault_rhsm_org }}"
        idm_rhsm_activation_key: "{{ vault_rhsm_key }}"
        idm_admin_password: "{{ vault_idm_admin_pw }}"
        idm_ds_password: "{{ vault_idm_ds_pw }}"
        idm_server_install: true
```

### Active Directory join

```yaml
- hosts: linux_servers
  roles:
    - role: identity_management
      vars:
        idm_action: enroll
        idm_type: ad_integration
        idm_domain: ad.example.com
        idm_ad_admin_user: Administrator
        idm_ad_admin_password: "{{ vault_ad_pw }}"
        idm_ad_permit_all_users: true
        idm_ad_enroll_execute: true
```

### OTP tokens for specific users

```yaml
- hosts: idm_servers
  roles:
    - role: identity_management
      vars:
        idm_action: otp
        idm_type: freeipa
        idm_domain: corp.example.com
        idm_otp_tokens:
          - owner: alice
            type: totp
            description: "Hardware TOTP key"
          - owner: bob
            type: hotp
            description: "HOTP counter token"
```

### Smart card (YubiKey PIV / CAC)

```yaml
- hosts: idm_servers
  roles:
    - role: identity_management
      vars:
        idm_action: smart_card
        idm_type: freeipa
        idm_domain: corp.example.com
        idm_smart_card_ca_cert_file: /etc/pki/ca-trust/source/anchors/sc-ca.pem
        idm_smart_card_server_configure: true
        idm_smart_card_required_users:
          - alice
          - bob
        idm_smart_card_cert_map_rules:
          - name: yubikey-piv-map
            description: "Map PIV cert CN to IPA username"
            maprule: "ipacertmapdata=X509:<I>{issuer_dn!nss_x500}<S>{subject_dn!nss_x500}"
            priority: 10
```

### RADIUS proxy (RSA SecurID + YubiKey Cloud)

```yaml
- hosts: idm_servers
  roles:
    - role: identity_management
      vars:
        idm_action: radius_proxy
        idm_type: freeipa
        idm_domain: corp.example.com
        idm_radius_servers:
          - name: rsa-primary
            server: rsa.corp.example.com
            secret: "{{ vault_rsa_secret }}"
            port: 1812
            type: rsa
        idm_radius_user_mappings:
          - username: privileged_user
            radius_proxy: rsa-primary
```

### Baseline (full stack, gated)

```yaml
- hosts: idm_servers
  roles:
    - role: identity_management
      vars:
        idm_action: baseline
        idm_type: freeipa
        idm_domain: corp.example.com
        idm_admin_password: "{{ vault_idm_admin_pw }}"
        idm_ds_password: "{{ vault_idm_ds_pw }}"
        idm_apply_server: true
        idm_server_install: true
        idm_apply_dns: true
        idm_dns_zones:
          - name: corp.example.com
            forward_policy: only
            forwarders:
              - 8.8.8.8
```

## Testing

```bash
# Default scenario — dispatcher and var-loading only (no real install)
cd roles/identity_management && molecule test -s default

# FreeIPA scenario — package availability + dry-run on RHEL9 UBI
cd roles/identity_management && molecule test -s freeipa

# Full CI pipeline
podman machine ssh "cd '$PWD' && bash bin/identity-management-ci.sh"

# Skip molecule for fast lint-only check
IDM_DO_MOLECULE=false bash bin/identity-management-ci.sh
```

## Security notes

- All passwords use `no_log: true`.
- AD join password is passed via `stdin:` — never appears in command args or logs.
- Vault-back `idm_admin_password`, `idm_ds_password`, `idm_ad_admin_password`,
  `idm_rhsm_activation_key`, and all RADIUS shared secrets.
- Gate variables (`idm_server_install`, `idm_client_install`, `idm_ad_enroll_execute`)
  default to `false` — all destructive actions are opt-in dry-run by default.

## Handlers

| Handler | Triggered by |
|---|---|
| `identity_management - restart ipa` | Server/replica install, trust config |
| `identity_management - restart sssd` | Client enroll, AD join |

## Part of

The `ansible_galaxy` platform orchestration repo — Platform Builder initiative.
See `docs/platform-builder-project-intent.md` for the full roadmap.

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9/ubi-minimal:latest | All dispatcher + validation tests pass |

**Scenario: default** — validates dispatcher routing and type variable loading for all 3 IDM types without a real FreeIPA/IDM server:

| Test | What is verified |
|---|---|
| `baseline` (freeipa, no-op) | `idm_type: freeipa` vars loaded; all apply toggles false; completes cleanly |
| `baseline` (rh_idm, no-op) | `idm_type: rh_idm` vars loaded; all apply toggles false; completes cleanly |
| `enroll` (ad_integration, dry-run) | AD join vars validated; `idm_enroll_execute: false` skips actual realm join |
| Dispatcher rejects invalid `idm_action` | `invalid_action` raises assertion error (caught in rescue block) |
| `server` rejected for `ad_integration` type | AD integration has no server action; dispatcher correctly rejects the combination |

Full deployment (FreeIPA/IDM server install, client enrollment, AD trust) requires a RHEL/Rocky target with appropriate DNS and network access.
