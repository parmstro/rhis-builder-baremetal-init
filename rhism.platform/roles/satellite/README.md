# satellite

## Description

Deploys and manages [Red Hat Satellite](https://www.redhat.com/en/technologies/management/satellite)
— the Red Hat subscription lifecycle and content management platform. The role registers the
host with RHSM, installs Satellite via `satellite-installer`, uploads the subscription
manifest, and manages organizations, CDN repository sets, products/repositories, sync plans,
content views, activation keys, smart proxies, and compute resources through the
`theforeman.foreman` collection.

This is a **content product role** (one of the content backends: `foreman`, `satellite`).
It is **standalone-first** — runnable on its own in a playbook — and is also **selected by the
`content_management` dispatcher** when `content_type: satellite`. Both content products consume
the **same variable interface** (`action`, `content_*`), so the dispatcher selects either with
one identical call and no per-product code. Foreman and Satellite are competing alternatives —
a site picks exactly one; Satellite is the Red Hat subscription choice (adds RHSM registration,
manifest upload, and CDN repository sets on top of the shared interface).

## Requirements

- Ansible: 2.15+ · Collections: `theforeman.foreman`, `community.general` (RHSM),
  `ansible.posix` (firewalld)
- Control target: EL9 host with a **Red Hat subscription entitled for Satellite**
- RHSM credentials: `content_rhsm_org_id` + `content_rhsm_activation_key` (from vault), and a
  subscription manifest at `content_rhsm_manifest_path`
- For API actions: a reachable Satellite server and admin credentials

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `status` | Lifecycle action (see choices below). Shared across both content products; the dispatcher passes it in. |
| `content_server_url` | `https://{{ ansible_fqdn }}` | Satellite API base URL. Shared interface var. |
| `content_username` / `content_password` | `admin` / `""` | Admin credentials for API calls. |
| `content_validate_certs` | `true` | Validate TLS certs on API calls. |
| `content_no_log` | `true` | Suppress credential-bearing task output (set `false` in dev). |
| `content_organization` / `content_location` | `Default Organization` / `Default Location` | Default scope. |
| `content_install_execute` | `false` | Dry-run gate — `false` prints the installer command instead of running it. |
| `content_installer_extra_args` | `[]` | Extra args passed verbatim to `satellite-installer`. |
| `content_rhsm_org_id` / `content_rhsm_activation_key` | `""` | RHSM registration credentials. |
| `content_rhsm_skip_registration` | `false` | Skip RHSM registration + repo enablement. |
| `content_rhsm_manifest_path` | `""` | Path to the RHSM manifest `.zip` to upload (empty = skip). |
| `content_proxy_dns` / `content_proxy_dhcp` / `content_proxy_tftp` | `false` | Open firewall for smart-proxy services. |
| `content_products` | `[]` | Products + repositories to manage (empty = no-op). |
| `content_cdn_repository_sets` | `[]` | Red Hat CDN repository sets (**Satellite-only**). |
| `content_lifecycle_environments` | `[]` | Lifecycle environments to create. |
| `content_sync_plans` / `content_sync_now` / `content_sync_products` | `[]` / `false` / `[]` | Sync plan management + optional immediate sync. |
| `content_views` / `content_views_publish` / `content_views_promote` | `[]` / `true` / `true` | Content views + publish/promote toggles. |
| `content_host_collections` / `content_activation_keys` | `[]` | Host collections + activation keys. |
| `content_settings` | `[]` | Global settings (name/value) to apply. |
| `content_proxies` / `content_compute_resources` | `[]` | Smart proxies / compute resources to register. |
| `content_hosts` | `[]` | Bare hosts to create + PXE-build (rhism alignment Phase C item 2, heavy path). |
| `content_host_execute` | `false` | Dry-run gate for the `host` action — a non-empty `content_hosts` alone is NOT enough to act, since this creates real hosts and can trigger a real PXE reboot. |
| `content_exports` | `[]` | Disconnected content to export — library/repository/version (rhism alignment Phase C item 3). |
| `content_pulp_export_dir` | `/var/lib/pulp/exports` | Server-side Pulp export root (Satellite's own convention). |
| `content_transfer_media_path` | `""` | Transfer-media destination for `transfer_media` — required, no default (fails closed). |
| `content_transfer_source_dir` | `{{ content_pulp_export_dir }}` | Directory `transfer_media` copies FROM. |
| `content_imports` | `[]` | Disconnected content to import — the receiving side of `content_exports`. |
| `content_soe_bundles` | `[]` | SOE (Standard Operating Environment) bundles — one composable spec per OS build, transformed into `content_views`/`content_lifecycle_environments`/`content_host_collections`/`content_activation_keys` and dispatched through those same task files (rhism alignment plan reuse-map item 1). |
| `content_soe_bundles_execute` | `true` | Dry-run gate for `soe_bundles` — `false` still validates + transforms bundles into their derived shapes but skips the two dispatch calls that talk to Satellite. |

**`action` choices:** `present`, `absent`, `started`, `stopped`, `restarted`, `install`,
`configure`, `cdn_repos`, `repos`, `sync`, `content_views`, `activation_keys`, `lifecycle`,
`smart_proxy`, `compute_resource`, `host`, `export_content`, `transfer_media`,
`import_content`, `soe_bundles`, `status`.

## Use Cases

**Standalone — install Satellite (dry-run gate defaults to false; set
`content_install_execute: true` to actually install):**

```yaml
- hosts: content_servers
  roles:
    - role: satellite
      vars:
        action: install
        content_rhsm_org_id: "1234567"
        content_rhsm_activation_key: "satellite-key"
        content_rhsm_manifest_path: /root/manifest.zip
        content_install_execute: true
```

**Standalone — enable Red Hat CDN repository sets on an existing Satellite:**

```yaml
- hosts: content_servers
  roles:
    - role: satellite
      vars:
        action: cdn_repos
        content_server_url: https://satellite.example.com
        content_cdn_repository_sets:
          - name: "Red Hat Enterprise Linux 9"
            sets:
              - name: "Red Hat Enterprise Linux 9 for x86_64 - BaseOS (RPMs)"
                repositories:
                  - releasever: "9"
```

**Standalone — check service + API health:**

```yaml
- hosts: content_servers
  roles:
    - role: satellite
      vars: { action: status }
```

**Standalone — disconnected/air-gapped content transfer (rhism alignment Phase C item 3),
run as three independent stages that can each execute on a different host/side of the gap:**

```yaml
# Connected side — export a known-good content-view version
- hosts: satellite_connected
  roles:
    - role: satellite
      vars:
        action: export_content
        content_exports:
          - name: rhel9-baseos-2026-07
            type: version
            content_view: "RHEL9 Baseline"
            content_view_version: "3.0"

# Either side — copy the export onto physical transfer media, checksum-verified
- hosts: satellite_connected
  roles:
    - role: satellite
      vars:
        action: transfer_media
        content_transfer_media_path: /media/transfer-usb

# Disconnected side — import from the media
- hosts: satellite_disconnected
  roles:
    - role: satellite
      vars:
        action: import_content
        content_server_url: https://satellite-disconnected.example.com
        content_imports:
          - name: rhel9-baseos-2026-07
            type: version
            path: /media/transfer-usb
```

**Standalone — SOE bundle model: declare one OS build's whole content posture in one entry**
(rhism alignment plan reuse-map item 1) instead of hand-syncing four separate lists:

```yaml
- hosts: content_servers
  roles:
    - role: satellite
      vars:
        action: soe_bundles
        content_soe_bundles:
          - name: rhel9-web-server
            lifecycle_environment: Production
            lifecycle_environment_prior: Testing
            repositories:
              - name: rhel9-baseos
              - name: rhel9-appstream
            subscriptions:
              - name: Red Hat Enterprise Linux Server
            host_collections:
              - name: rhel9-web-servers
                description: RHEL9 web server fleet
            # Reference only — this role does not create hostgroups or
            # kickstart snippets. Hand this name to content_hosts[].hostgroup
            # (the 'host' action) when provisioning real hosts against this SOE.
            hostgroup: RHEL9/WebServer
            kickstart_snippet: rhel9-web-server-ks
```

This is a pure composability layer over the existing `content_views`/`activation_keys`
mechanics — `soe_bundles` transforms each entry and dispatches through the SAME
`content_views.yml`/`activation_keys.yml` task logic those actions already use, no parallel
API-calling logic. See [`docs/satellite.md`](docs/satellite.md)'s SOE bundle model section for
the field reference and the full transform.

**Via the `content_management` dispatcher** (same code selects either product):

```yaml
- hosts: content_servers
  roles:
    - role: content_management
      vars:
        content_action: install
        content_type: satellite
```

## Testing

```bash
cd roles/satellite && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `content_install_execute: false` and
empty content lists, so it validates argument-spec enforcement, action dispatch, the shared
variable contract, and the negative (bad-action) path without needing a Red Hat subscription
or a live Satellite server. A real installation is exercised in the full-stack test lab
(`inventories/test/`), not in molecule (CI has no Satellite entitlement). `transfer_media` and
`soe_bundles` each get a genuine functional test in molecule itself, not just contract
validation: `transfer_media` (no Satellite API call involved) does a real fixture file
round-trip with checksum verification, plus a negative test proving the fail-closed behaviour
with no destination configured; `soe_bundles`'s transform (no Satellite API call when
`content_soe_bundles_execute: false`) runs against a real fixture SOE bundle and asserts the
derived `content_views`/`activation_keys` shapes are correct, plus a negative test proving an
incomplete bundle entry is rejected.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9 control node (Red Hat subscription required for a real deployment). License: MIT.

## Related Information

- Depth doc: [`docs/satellite.md`](docs/satellite.md) — internals, RHSM/install workflow,
  CDN repos, bare-host provisioning, disconnected content transfer, the SOE bundle model,
  permutations, and gotchas (mirrored to the orchestration repo's `docs/satellite.md`).
- Family index: [`docs/content-management.md`](../../docs/content-management.md) — the content
  product family and the shared `content_*` interface.
- Sibling product: `foreman` (open-source upstream — no subscription).
- Dispatcher: `content_management` (`content_type`).
