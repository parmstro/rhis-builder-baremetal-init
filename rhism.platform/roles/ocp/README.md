# ocp

## Description

Installs and manages [Red Hat OpenShift Container Platform](https://www.redhat.com/en/technologies/cloud-computing/openshift)
(OCP) on EL9 using `openshift-install` and `oc`. The role registers the installer host with
RHSM, downloads the installer/client from the Red Hat mirror, renders the install-config,
runs the gated cluster install/destroy, scales worker MachineSets, backs up and restores
etcd, and drives upgrades.

This is a **Kubernetes-distro product role** (one of `k3s`, `rke2`, `okd`, `ocp`). It is
**standalone-first** — runnable on its own in a playbook — and is also **selected by the
`container_platform` dispatcher** when `cp_type: ocp`. Every distro consumes the **same
variable interface** (bare `action`, `cp_*` vars), so the dispatcher selects any of them with
one identical call and no per-distro code. Unlike `okd`, OCP requires a Red Hat subscription.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld), `community.general` (redhat_subscription)
- A Red Hat subscription with OpenShift entitlement (RHSM org ID + activation key)
- A pull secret from console.redhat.com and an SSH public key (install-config inputs)
- An EL9 installer/bastion host with outbound access to the Red Hat mirror
- Infrastructure DNS, load balancer, and (for IPI) cloud/hypervisor credentials

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `present` | `present`/`absent` · `configure` · `install`/`destroy` · `add_node`/`remove_node` · `backup`/`restore` · `upgrade` · `status`. Shared across all distros; the dispatcher passes it in. |
| `cp_ocp_version` | `""` | OCP release version used in the Red Hat mirror download URLs. |
| `cp_cluster_name` | `ocp` | Cluster name (console/API URLs, install-config). |
| `cp_base_domain` | `example.com` | Cluster base DNS domain (console/API URLs, install-config). |
| `cp_pull_secret` | `""` | Registry pull secret for the install-config. |
| `cp_ssh_pub_key` | `""` | SSH public key injected into cluster nodes via install-config. |
| `cp_install_dir` | `/opt/openshift-install` | Installer working directory. |
| `cp_backup_dir` / `cp_restore_dir` | `/var/backup/etcd` | etcd backup / restore directories. |
| `cp_node_machineset` | `""` | MachineSet to scale for `add_node` / `remove_node`. |
| `cp_node_replicas` | `1` | Replica count when scaling in `add_node`. |
| `cp_upgrade_version` | `""` | Target upgrade version; empty = `--to-latest`. |
| `cp_rhsm_skip_registration` | `false` | Skip RHSM registration in `present` (host already entitled). |
| `cp_rhsm_org_id` | `""` | RHSM organization ID for registration. |
| `cp_rhsm_activation_key` | `""` | RHSM activation key for registration. |
| `cp_install_execute` | `false` | Must be `true` to run `openshift-install create cluster`. |
| `cp_destroy_confirm` | `false` | Must be `true` to run `openshift-install destroy cluster`. |

## Use Cases

**Standalone — register RHSM, stage binaries, open firewall ports:**

```yaml
- hosts: ocp_installer
  roles:
    - role: ocp
      vars:
        action: present
        cp_ocp_version: "4.15.0"
        cp_rhsm_org_id: "{{ vault_rhsm_org }}"
        cp_rhsm_activation_key: "{{ vault_rhsm_key }}"
```

**Standalone — render the install-config:**

```yaml
- hosts: ocp_installer
  roles:
    - role: ocp
      vars:
        action: configure
        cp_cluster_name: prod
        cp_base_domain: ocp.example.com
        cp_pull_secret: "{{ vault_ocp_pull_secret }}"
        cp_ssh_pub_key: "{{ vault_ocp_ssh_key }}"
```

**Standalone — run the install (gated):**

```yaml
- hosts: ocp_installer
  roles:
    - role: ocp
      vars:
        action: install
        cp_install_execute: true   # required — install is fail-closed by default
```

**Via the `container_platform` dispatcher** (same code selects any distro):

```yaml
- hosts: openshift_installer
  roles:
    - role: container_platform
      vars:
        cp_action: install
        cp_type: ocp
        cp_rhsm_skip_registration: true
```

## Testing

```bash
cd roles/ocp && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario is a control-host contract converge (`hosts: localhost`,
`gather_facts: false`): it loads defaults via `include_vars`, runs the argument-spec
negative test (bogus action), asserts the standalone default contract, and stats that each
dispatch task file exists. It validates argument-spec enforcement, action dispatch, the
shared variable contract, the install fail-closed gate, and the negative (bad-action) path
— without registering RHSM, downloading binaries, or creating a cluster. A real OCP install
(the `install`/`configure` actions) requires an entitled installer host + infrastructure
and is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

- **BUG-041** (2026-07-02): sudo `secure_path` on EL9 excludes `/usr/local/bin`, so a bare
  `oc` in `command:` tasks under `become: true` is unresolvable. `_cp_kubectl_cmd` is now the
  absolute `/usr/local/bin/oc` (family-wide fix discovered by the k3s functional scenario —
  see `docs/k3s-rootless-podman-research.md`).

- `configure` renders `templates/install-config.yaml.j2` (added 2026-07-01). Molecule does
  not exercise `configure` — the contract converge stats the dispatch task file rather than
  dispatching the action, which needs an entitled installer host + infrastructure.

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/ocp.md`](../../docs/ocp.md) — internals, workflows, permutations, gotchas.
- Family index: [`docs/container-platform.md`](../../docs/container-platform.md) — the
  Kubernetes-distro family and the shared `cp_*` interface.
- Sibling distros: `k3s`, `rke2`, `okd`.
- Dispatcher: `container_platform` (`cp_type`).
