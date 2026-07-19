# cobbler

## Description

Installs and configures [Cobbler](https://cobbler.github.io/) to drive **network installs**
over PXE/DHCP/DNS/TFTP — registering distros, profiles, and systems, then syncing them into
the boot infrastructure. Cobbler is the richer provisioning backend when a site wants managed
install profiles but has **no Satellite or Foreman**.

This is a **product role** (one of the provisioning backends: `dnsmasq`, `cobbler`,
`foreman_proxy`, `satellite_proxy`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `provisioning_services` dispatcher** when
`prov_type: cobbler`. Every backend consumes the **same variable interface** (bare `action`,
`prov_*` vars), so the dispatcher selects any of them with one identical call and no
per-backend code.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld), `ansible.builtin`
- EL9 host able to install `cobbler`, `cobbler-web`, `pykickstart`, `fence-agents`, `httpd`
- `firewalld` running (dns/dhcp/tftp/http/https services opened on install)

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `configure` | `present`/`absent` · `configure` · `add_distro`/`add_profile` · `add_system`/`add_systems`/`remove_system` · `sync` · `status` · `started`/`stopped`/`restarted`. Shared across all provisioning backends; the dispatcher passes it in. |
| `prov_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without touching the host. |
| `prov_manage_service` | `true` | Provisioning-family service toggle — guards `started`/`stopped`/`restarted` and the restart handler. Set `false` in non-systemd contexts (containers). |
| `prov_cobbler_server` | `localhost` | Cobbler server address written to `settings.yaml` (`server:`). |
| `prov_cobbler_next_server` | `""` | PXE next-server (TFTP) address, written to `next_server_v4:` only when set (renamed from `next_server` in Cobbler 3.3). |
| `prov_cobbler_manage_dhcp` | `true` | Let Cobbler manage DHCP. |
| `prov_cobbler_manage_dns` | `true` | Let Cobbler manage DNS. |
| `prov_cobbler_manage_tftp` | `true` | Let Cobbler manage TFTP (also ensures the tftpboot dir on `configure`). |
| `prov_cobbler_client_use_localhost` | `true` | Set cobbler's `client_use_localhost` so the local `cobbler` CLI reaches the API over `127.0.0.1` rather than the advertised `server` IP. Required whenever `server` is a routable IP that is not a local address on the cobbler host. |
| `prov_cobbler_tftpboot_dir` | `/var/lib/tftpboot` | TFTP root ensured on `configure`. |
| `prov_cobbler_settings_group` | `apache` | Group owning `settings.yaml` (cobbler's mod_wsgi `cobbler_api` reads it as this group; shipped `root:apache 0640`). |
| `prov_cobbler_distros` | `[]` | Reference list of distros for bulk workflows. |
| `prov_cobbler_profiles` | `[]` | Reference list of profiles for bulk workflows. |
| `prov_cobbler_distro` | `{}` | `add_distro` input (name/kernel/initrd/os_version; arch/breed defaulted). |
| `prov_cobbler_profile` | `{}` | `add_profile` input (name/distro; kickstart optional). |
| `prov_cobbler_system` | `{}` | `add_system` input (name/profile/mac/ip/hostname). |
| `prov_cobbler_systems` | `[]` | `add_systems` bulk input (list of the same shape) — rhism alignment Phase C item 2, light path. |
| `prov_cobbler_system_name` | `""` | `remove_system` target. |

## Use Cases

**Standalone — install and configure Cobbler:**

```yaml
- hosts: pxe_servers
  roles:
    - role: cobbler
      vars:
        action: present
        prov_cobbler_server: cobbler.lab.example.com
        prov_cobbler_next_server: 192.168.1.10
```

**Standalone — register a distro:**

```yaml
- hosts: pxe_servers
  roles:
    - role: cobbler
      vars:
        action: add_distro
        prov_cobbler_distro:
          name: rhel9
          kernel: /var/www/cobbler/distro_mirror/rhel9/images/pxeboot/vmlinuz
          initrd: /var/www/cobbler/distro_mirror/rhel9/images/pxeboot/initrd.img
          os_version: rhel9
```

**Standalone — register a system:**

```yaml
- hosts: pxe_servers
  roles:
    - role: cobbler
      vars:
        action: add_system
        prov_cobbler_system:
          name: server01
          profile: rhel9-basic
          mac: "aa:bb:cc:dd:ee:ff"
          ip: 192.168.1.50
          hostname: server01.lab.example.com
```

**Via the `provisioning_services` dispatcher** (same code selects any backend):

```yaml
- hosts: pxe_servers
  roles:
    - role: provisioning_services
      vars:
        prov_action: baseline
        prov_type: cobbler
        prov_cobbler_server: cobbler.lab.example.com
```

## Testing

```bash
cd roles/cobbler && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `prov_execute: false`, so it validates
argument-spec enforcement, action dispatch, the shared variable contract, and the negative
(bad-action) path without installing packages or running the cobbler CLI. A real Cobbler
deployment is exercised in the full-stack test lab and by the image-factory live role test
(`playbooks/cobbler_image_factory.yml`), not in molecule.

**settings.yaml is updated in place, never overwritten.** Cobbler 3.3 ships a large,
strictly schema-validated `/etc/cobbler/settings.yaml`; `cobblerd` refuses to start if it is
replaced with a sparse file or a value has the wrong type. `configure` therefore edits only
the managed keys (`server`, `next_server_v4`, `manage_dhcp`/`manage_dns`/`manage_tftpd`,
`client_use_localhost`) with `lineinfile`, preserving the shipped file and its `root:apache`
ownership that the mod_wsgi `cobbler_api` needs.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |
| image-factory live role test | ubi9-secure (cobbler 3.3.7-15.el9) | Pass (2026-07-14) — configure + add_distro/add_profile/add_system + sync converged against a running cobblerd/httpd; distro/system persisted across an entrypoint restart; XML-RPC API answered. |

### Bugfixes

The 2026-07-14 image-factory run (live role test against cobbler 3.3.7-15.el9) found and
fixed:

- **settings.yaml wholesale overwrite** — the role replaced the shipped 588-key
  schema-validated `settings.yaml` with a sparse template; `cobblerd` fails schema
  validation and will not start. `configure` now edits managed keys in place.
- **stale `next_server` key** — renamed to `next_server_v4`/`next_server_v6` in Cobbler 3.3;
  the role now writes `next_server_v4`.
- **invalid boolean literals** — `restart_dhcp: 1` etc. (int) fail the 3.3 bool schema; those
  non-contract keys were dropped.
- **ungated service/handler** — `started`/`stopped`/`restarted` and the restart handler now
  honour `prov_manage_service` (fail with no systemd otherwise).
- **missing `client_use_localhost`** — CLI actions could not reach the API when `server` was a
  non-local advertised IP; now managed via `prov_cobbler_client_use_localhost` (default true).
- **hard-coded tftpboot path** — now `prov_cobbler_tftpboot_dir`.
- **restart handler restarted only cobblerd** — mod_wsgi kept a stale XML-RPC shared secret
  (`login failed`); the handler now restarts httpd after cobblerd.

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/cobbler.md`](docs/cobbler.md) — internals, settings rendering,
  per-action workflows, bulk registration, and gotchas (mirrored to the orchestration repo's
  `docs/cobbler.md`).
- Family index: [`docs/provisioning-services.md`](../../docs/provisioning-services.md) — the
  provisioning backend family and the shared `prov_*` interface.
- Sibling backends: `dnsmasq`, `foreman_proxy`, `satellite_proxy`.
- Dispatcher: `provisioning_services` (`prov_type`).
