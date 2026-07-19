# content_management

Ansible role for managing software content lifecycle on **Foreman** and
**Red Hat Satellite**. Covers the full pipeline: install → configure → product/repo
management → sync → content views → activation keys.

Follows the same **dispatcher + type-driven vars** pattern as `vm_provisioning` and
`identity_management` in this repo.

## Actions

| `content_action` | Description |
|---|---|
| `install` | Install and configure the Foreman/Satellite server |
| `configure` | Manage organization, location, lifecycle environments, global settings, RHSM manifest |
| `repos` | Create products and repositories (Foreman: custom URLs; Satellite: CDN sets + custom) |
| `sync` | Create sync plans, assign products, optionally trigger immediate sync |
| `content_views` | Create content views, publish versions, promote to lifecycle environments |
| `activation_keys` | Create host collections and activation keys |
| `baseline` | Run a selected subset of actions gated by boolean toggles |

## Types

| `content_type` | Backend | Collection used |
|---|---|---|
| `foreman` | Open-source Foreman (community) | `theforeman.foreman` |
| `satellite` | Red Hat Satellite (RHSM subscription required) | `redhat.satellite` |

## Requirements

- Ansible Core 2.14+
- `theforeman.foreman` collection (Foreman API modules)
- `redhat.satellite` collection (Satellite API modules — same interface, different namespace)
- `community.general` collection (`redhat_subscription` for Satellite type)
- `ansible.posix` collection (firewalld)
- `apypie` Python package (Foreman API Python client)

Install via:
```bash
ansible-galaxy collection install theforeman.foreman redhat.satellite ansible.posix community.general
pip install apypie
```

Or use the project EE: `ansible_galaxy_cm_ee:latest` (built by `bin/content-management-ci.sh`).

## Key variables

### Common

| Variable | Default | Description |
|---|---|---|
| `content_action` | `baseline` | Action to perform |
| `content_type` | `foreman` | Backend type |
| `content_server_url` | `https://{{ ansible_fqdn }}` | Foreman/Satellite URL |
| `content_username` | `admin` | API username |
| `content_password` | `""` | API password (vault-backed) |
| `content_validate_certs` | `true` | Validate TLS certificate |
| `content_no_log` | `true` | Suppress task output (set false in dev) |
| `content_organization` | `Default Organization` | Organization scope |
| `content_location` | `Default Location` | Location scope |

### Install

| Variable | Default | Description |
|---|---|---|
| `content_install_execute` | `false` | **Gate.** Set `true` to run installer. Default is dry-run. |
| `content_installer_extra_args` | `[]` | Extra flags passed to foreman-installer or satellite-installer |
| `content_proxy_dns` | `false` | Enable integrated DNS proxy |
| `content_proxy_dhcp` | `false` | Enable integrated DHCP proxy |
| `content_proxy_tftp` | `false` | Enable integrated TFTP proxy |

### RHSM (satellite type)

| Variable | Default | Description |
|---|---|---|
| `content_rhsm_org_id` | `""` | RHSM organization ID (no_log) |
| `content_rhsm_activation_key` | `""` | RHSM activation key (no_log) |
| `content_rhsm_skip_registration` | `false` | Skip if host already registered |
| `content_rhsm_manifest_path` | `""` | Path to RHSM manifest .zip |

### Products and repositories

```yaml
content_products:
  - name: "RHEL 9"
    label: rhel-9
    description: "Red Hat Enterprise Linux 9"
    repos:
      - name: "BaseOS x86_64"
        content_type: yum
        url: https://mirror.example.com/rhel9/baseos/x86_64/os/
        download_policy: on_demand    # immediate | on_demand | streamed

# Satellite CDN only:
content_cdn_repository_sets:
  - name: "Red Hat Enterprise Linux 9"
    sets:
      - name: "Red Hat Enterprise Linux 9 for x86_64 - BaseOS (RPMs)"
        repositories:
          - releasever: "9"
```

### Sync plans

```yaml
content_sync_plans:
  - name: "Daily sync"
    interval: daily              # hourly | daily | weekly | custom
    sync_date: "2024-01-01 01:00:00 UTC"
    enabled: true
    products:
      - "RHEL 9"

content_sync_now: false          # trigger immediate sync after plan setup
content_sync_products:
  - "RHEL 9"
```

### Lifecycle environments

```yaml
content_lifecycle_environments:
  - name: Development
    prior: Library
  - name: QA
    prior: Development
  - name: Production
    prior: QA
```

### Content views

```yaml
content_views:
  - name: "RHEL9 Base"
    description: "RHEL9 base content view"
    repositories:
      - name: "BaseOS x86_64"
        product: "RHEL 9"
    lifecycle_environments:
      - Library
      - Development
      - Production

content_views_publish: true     # publish new version after managing CV
content_views_promote: true     # promote to specified lifecycle environments
```

### Activation keys

```yaml
content_activation_keys:
  - name: "rhel9-dev"
    lifecycle_environment: Development
    content_view: "RHEL9 Base"
    auto_attach: true
    subscriptions: []            # Satellite only — subscription names
    host_collections:
      - "RHEL9 Servers"

content_host_collections:
  - name: "RHEL9 Servers"
    description: "All RHEL9 servers"
```

### Baseline toggles

| Variable | Default | Description |
|---|---|---|
| `content_apply_install` | `false` | Include install action |
| `content_apply_configure` | `false` | Include configure action |
| `content_apply_repos` | `false` | Include repos action |
| `content_apply_sync` | `false` | Include sync action |
| `content_apply_content_views` | `false` | Include content_views action |
| `content_apply_activation_keys` | `false` | Include activation_keys action |

## Usage examples

### Foreman install (dry-run)

```yaml
- hosts: content_servers
  roles:
    - role: content_management
      vars:
        content_action: install
        content_type: foreman
        content_organization: "ACME"
        content_location: "Default Location"
        content_username: admin
        content_password: "{{ vault_foreman_admin_pw }}"
        content_install_execute: false    # set true to run foreman-installer
        content_proxy_dns: true
        content_proxy_dhcp: true
        content_proxy_tftp: true
```

### Satellite install (with RHSM)

```yaml
- hosts: content_servers
  roles:
    - role: content_management
      vars:
        content_action: install
        content_type: satellite
        content_organization: "ACME"
        content_rhsm_org_id: "{{ vault_rhsm_org }}"
        content_rhsm_activation_key: "{{ vault_rhsm_key }}"
        content_rhsm_manifest_path: /opt/satellite-manifest.zip
        content_username: admin
        content_password: "{{ vault_satellite_admin_pw }}"
        content_install_execute: true
```

### Foreman full lifecycle (baseline)

```yaml
- hosts: content_servers
  roles:
    - role: content_management
      vars:
        content_action: baseline
        content_type: foreman
        content_server_url: https://foreman.corp.example.com
        content_organization: "ACME"
        content_location: "Default Location"
        content_username: admin
        content_password: "{{ vault_foreman_admin_pw }}"
        content_apply_configure: true
        content_apply_repos: true
        content_apply_sync: true
        content_apply_content_views: true
        content_apply_activation_keys: true
        content_lifecycle_environments:
          - name: Development
            prior: Library
          - name: Production
            prior: Development
        content_products:
          - name: "RHEL 9"
            repos:
              - name: "BaseOS x86_64"
                content_type: yum
                url: https://mirror.example.com/rhel9/baseos/x86_64/os/
        content_sync_plans:
          - name: "Daily"
            interval: daily
            sync_date: "2024-01-01 01:00:00 UTC"
            products: ["RHEL 9"]
        content_views:
          - name: "RHEL9"
            repositories:
              - name: "BaseOS x86_64"
                product: "RHEL 9"
            lifecycle_environments:
              - Library
              - Development
              - Production
        content_activation_keys:
          - name: "rhel9-dev"
            lifecycle_environment: Development
            content_view: "RHEL9"
            auto_attach: true
```

## Testing

```bash
# Default scenario — dispatcher + var loading, no real server required
cd roles/content_management && molecule test -s default

# Foreman scenario — dry-run on RHEL9 UBI
cd roles/content_management && molecule test -s foreman

# Full CI pipeline
podman machine ssh "cd '$PWD' && bash bin/content-management-ci.sh"

# Skip molecule for fast lint-only check
CM_DO_MOLECULE=false bash bin/content-management-ci.sh
```

## Security notes

- All API passwords use `content_no_log: true` (default). Set `content_no_log: false` in dev/testing.
- RHSM credentials (org_id, activation_key) are `no_log: true` unconditionally.
- Vault-back `content_password`, `content_rhsm_org_id`, `content_rhsm_activation_key`.
- `content_install_execute: false` default means no packages installed or installer run without explicit opt-in.

## Handlers

| Handler | Triggered by |
|---|---|
| `content_management - restart foreman` | Foreman install |
| `content_management - restart satellite` | Satellite install |

## Part of

The `ansible_galaxy` platform orchestration repo — Platform Builder initiative.
See `docs/platform-builder-project-intent.md` for the full roadmap.

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9/ubi:latest | All dispatcher + dry-run tests pass |

**Scenario: default** — validates dispatcher routing and variable loading without a real Foreman or Satellite instance:

| Test | What is verified |
|---|---|
| `baseline` (foreman, no-op) | `content_type: foreman` vars loaded; completes without applying anything |
| `baseline` (satellite, no-op) | `content_type: satellite` vars loaded; RHSM skip flag respected |
| `install` (foreman, dry-run) | `content_install_execute: false` skips installer download; task logic exercised |
| `install` (satellite, dry-run) | `content_install_execute: false` with RHSM skip; task logic exercised |
| Dispatcher rejects invalid `content_action` | `bogus_action` raises assertion error (caught in rescue block) |
| Dispatcher rejects invalid `content_type` | `bogus_type` raises assertion error (caught in rescue block) |

Full deployment (Foreman installer, Satellite subscription registration, repo sync) requires a RHEL/Rocky target with RHSM credentials and network access to CDN.
