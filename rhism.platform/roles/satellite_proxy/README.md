# satellite_proxy

## Description

Installs, configures, and registers a **Red Hat Satellite smart proxy** (the `foreman-proxy`
service) that fronts **DNS, DHCP, and TFTP/PXE** for a remote network segment and reports back
to a central Satellite server. Use this backend when the site runs Red Hat Satellite and needs
provisioning services extended to an isolated subnet.

This is a **product role** (one of the provisioning backends: `dnsmasq`, `cobbler`,
`foreman_proxy`, `satellite_proxy`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `provisioning_services` dispatcher** when
`prov_type: satellite_proxy`. Every backend consumes the **same variable interface** (bare
`action`, `prov_*` vars), so the dispatcher selects any of them with one identical call and no
per-backend code.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld), `redhat.satellite` (for the
  `register` and `status` actions), `ansible.builtin`
- EL9 host able to install `foreman-proxy` (Satellite client repos configured)
- `firewalld` running (dns/dhcp/tftp services and the 8443/tcp API port opened on install)
- A reachable Red Hat Satellite server and API credentials for `register` / `status`

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `configure` | `present`/`absent` · `started`/`stopped`/`restarted` · `configure` · `register` · `status`. Shared across all provisioning backends; the dispatcher passes it in. |
| `prov_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without touching the host. |
| `prov_smartproxy_url` | `""` | This proxy's own URL registered with the Satellite server. |
| `prov_smartproxy_dns` | `true` | Advertise DNS capability. |
| `prov_smartproxy_dhcp` | `true` | Advertise DHCP capability. |
| `prov_smartproxy_tftp` | `true` | Advertise TFTP/PXE capability. |
| `prov_smartproxy_realm` | `false` | Advertise realm (identity enrolment) capability. |
| `prov_content_server_url` | `""` | Satellite server URL (register / status). |
| `prov_content_username` | `admin` | Satellite API username. |
| `prov_content_password` | `""` | Satellite API password (supply via vault). |
| `prov_content_validate_certs` | `true` | Validate TLS to the Satellite API. |
| `prov_content_organization` | `Default Organization` | Organization the proxy registers into. |
| `prov_content_location` | `Default Location` | Location the proxy registers into. |

## Use Cases

**Standalone — install and configure the smart proxy:**

```yaml
- hosts: proxy_servers
  roles:
    - role: satellite_proxy
      vars:
        action: present
    - role: satellite_proxy
      vars:
        action: configure
        prov_smartproxy_url: https://proxy.example.com:8443
```

**Standalone — register the proxy with a Satellite server:**

```yaml
- hosts: proxy_servers
  roles:
    - role: satellite_proxy
      vars:
        action: register
        prov_smartproxy_url: https://proxy.example.com:8443
        prov_content_server_url: https://satellite.example.com
        prov_content_password: "{{ vault_satellite_password }}"
```

**Via the `provisioning_services` dispatcher** (same code selects any backend):

```yaml
- hosts: proxy_servers
  roles:
    - role: provisioning_services
      vars:
        prov_action: configure
        prov_type: satellite_proxy
        prov_smartproxy_url: https://proxy.example.com:8443
```

## Testing

```bash
cd roles/satellite_proxy && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `prov_execute: false`, so it validates
argument-spec enforcement, action dispatch, the shared variable contract, and the negative
(bad-action) path without installing packages or touching the host. A real smart proxy
registration is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/satellite_proxy.md`](../../docs/satellite_proxy.md) — internals,
  registration workflow, per-action detail, and gotchas.
- Family index: [`docs/provisioning-services.md`](../../docs/provisioning-services.md) — the
  provisioning backend family and the shared `prov_*` interface.
- Sibling backends: `dnsmasq`, `cobbler`, `foreman_proxy`.
- Dispatcher: `provisioning_services` (`prov_type`).
