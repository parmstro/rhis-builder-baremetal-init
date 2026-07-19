# kvm_platform

## Description

`kvm_platform` manages the **KVM/libvirt hypervisor host platform itself** — installing
qemu-kvm/libvirt packages, enabling the `libvirtd` service, defining the default storage
pool and network, upgrading the host package set, and (gated) decommissioning the platform.

This is a **product role** in the role-definition doctrine sense: one of an open,
extensible set of hypervisor-host products a user picks exactly one of. It is
**standalone-first** — no dispatcher currently selects it, but it is written to the same
shared-interface conventions (`<role>_action`, `<role>_execute` dry-run gate,
`meta/argument_specs.yml` contract) as every other product role in this platform, so a
future hypervisor-selecting dispatcher could adopt it without changing its variable names.

**Scope boundary vs. `roles/vm_provisioning`**: `kvm_platform` stops at "the hypervisor
host is installed, its service is running, and a default storage pool/network exist."
It never touches a VM guest. `roles/vm_provisioning` picks up from there —
`vm_action: create_vm | destroy_vm | gold_build | gold_patch | cloud_init |
network_persist` — and assumes a KVM host already configured by this role (or an
equivalent manual setup). Run `kvm_platform` first on a fresh hypervisor host, then run
`vm_provisioning` against it to provision guests.

## Requirements

- Ansible / Python: ansible-core 2.15+
- Collections: `community.libvirt` (`virt_pool`, `virt_net`), `community.general`
  (`nmcli`, only used when `kvm_platform_manage_bridge: true`). `community.libvirt` is
  already declared in `playbooks/infra_ee.yml`'s `ee_collections` — no EE changes needed
  to use this role from the orchestration repo.
- System dependencies: a host with hardware virtualization support (Intel VT-x / AMD-V)
  exposed to the OS. See **Nested-virtualization sanity check** below.
- Auth / credentials: none beyond normal `become: true` privilege escalation.

## Role Variables

| Variable | Default | Description |
|----------|---------|--------------|
| `kvm_platform_action` | `install` | Action: `install`, `configure`, `upgrade`, `remove` |
| `kvm_platform_execute` | `true` | Dry-run gate around every state-changing task; `false` in molecule |
| `kvm_platform_uri` | `qemu:///system` | libvirt connection URI (`qemu:///system` or `qemu:///session`) |
| `kvm_platform_packages` | `[]` | Explicit package list; empty = auto-select for `ansible_facts['os_family']` |
| `kvm_platform_manage_service` | `true` | Manage the libvirtd service |
| `kvm_platform_libvirt_service` | `libvirtd` | Service/unit name |
| `kvm_platform_manage_bridge` | `false` | Create a host bridge via `community.general.nmcli` during `install` |
| `kvm_platform_bridge_name` | `br0` | Bridge device name |
| `kvm_platform_bridge_interface` | `""` | Physical NIC to enslave; empty = bridge only |
| `kvm_platform_pool_name` | `default` | Default storage pool name |
| `kvm_platform_pool_type` | `dir` | Storage pool type |
| `kvm_platform_pool_path` | `/var/lib/libvirt/images` | Storage pool backing path |
| `kvm_platform_pool_autostart` | `true` | Autostart the storage pool |
| `kvm_platform_network_name` | `default` | Default network name |
| `kvm_platform_network_forward_mode` | `nat` | Network forward mode |
| `kvm_platform_network_bridge` | `virbr0` | libvirt-managed bridge device |
| `kvm_platform_network_ip` / `_netmask` | `192.168.122.1` / `255.255.255.0` | Network gateway + netmask |
| `kvm_platform_network_dhcp_start` / `_end` | `192.168.122.2` / `.254` | DHCP range |
| `kvm_platform_network_autostart` | `true` | Autostart the network |
| `kvm_platform_check_nested_virt` | `true` | Informational `/dev/kvm` + `kvm_intel`/`kvm_amd` sanity check |
| `kvm_platform_confirm_delete` | `false` | Must be `true` for `remove` to run its destructive block |
| `kvm_platform_purge_storage_pool` | `false` | Also delete the default pool on `remove` |
| `kvm_platform_purge_network` | `false` | Also delete the default network on `remove` |

See `defaults/main.yml` for full inline documentation and `vars/main.yml` for the
internal RedHat/Debian package map.

## Use Cases

```yaml
# Standalone — install the KVM host platform
- hosts: hypervisors
  roles:
    - role: kvm_platform
      vars:
        kvm_platform_action: install
```

```yaml
# Standalone — configure the default storage pool + network, run nested-virt checks
- hosts: hypervisors
  roles:
    - role: kvm_platform
      vars:
        kvm_platform_action: configure
```

```yaml
# Standalone — upgrade the host package set
- hosts: hypervisors
  roles:
    - role: kvm_platform
      vars:
        kvm_platform_action: upgrade
```

```yaml
# Standalone — decommission (destructive; requires explicit confirmation)
- hosts: hypervisors
  roles:
    - role: kvm_platform
      vars:
        kvm_platform_action: remove
        kvm_platform_confirm_delete: true
        kvm_platform_purge_storage_pool: true
        kvm_platform_purge_network: true
```

```yaml
# Full lifecycle: platform first, then a guest VM via vm_provisioning
- hosts: hypervisors
  roles:
    - role: kvm_platform
      vars: { kvm_platform_action: install }
    - role: kvm_platform
      vars: { kvm_platform_action: configure }
    - role: vm_provisioning
      vars: { vm_action: create_vm, vm_hypervisor: kvm, vm_name: web-prod-01 }
```

No dispatcher currently selects between hypervisor-host products — this role is used
standalone. If a `hypervisor_platform`-style dispatcher is added in the future, it would
select this role the same way `container_platform` selects `storage_longhorn`.

## Testing

```bash
cd roles/kvm_platform && molecule test
```

The default scenario runs entirely with `kvm_platform_execute: false` — qemu-kvm/libvirtd
cannot run meaningfully inside a nested container (see `docs/kvm_platform.md` and
`docs/k3s-rootless-podman-research.md` for the flavor of the underlying constraint, even
though that doc covers a different technology). It validates: dispatch to all four action
files, the full standalone default contract, and the `remove` safety gate (block/rescue
negative test — `remove` without `kvm_platform_confirm_delete: true` must fail) plus a
bogus-action negative test. A real functional scenario exercising real package
install/libvirtd/pool/network needs a bare-metal-ish test host with `/dev/kvm` exposed —
not available in this repo's CI today.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | registry.access.redhat.com/ubi9/ubi-init:latest | Pending first run |

### Bugfixes

_None yet — role just scaffolded._

## Support / License

Supported on EL 9. License: MIT.

## Related Information

- Depth doc: `docs/kvm_platform.md` — internals, workflow, the `community.libvirt`
  CLI-vs-API parity findings, and the nested-virtualization test constraint.
- `roles/vm_provisioning/` — VM guest lifecycle on top of a `kvm_platform`-managed host.
- Upstream: [`community.libvirt` collection](https://github.com/ansible-collections/community.libvirt).
