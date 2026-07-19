# okd

## Description

Installs and manages [OKD](https://okd.io/) (the community distribution that OpenShift is
built from) on EL9 using `openshift-install` and `oc`. The role downloads the installer/client
binaries from OKD's GitHub releases, renders the install-config, runs the gated cluster
install/destroy, scales worker MachineSets, backs up and restores etcd, and drives upgrades.

This is a **Kubernetes-distro product role** (one of `k3s`, `rke2`, `okd`, `ocp`). It is
**standalone-first** — runnable on its own in a playbook — and is also **selected by the
`container_platform` dispatcher** when `cp_type: okd`. Every distro consumes the **same
variable interface** (bare `action`, `cp_*` vars), so the dispatcher selects any of them with
one identical call and no per-distro code. Unlike `ocp`, OKD needs no Red Hat subscription.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld)
- An EL9 installer/bastion host with outbound access to GitHub OKD releases
- Infrastructure DNS, load balancer, and (for IPI) cloud/hypervisor credentials for the target
- A pull secret and SSH public key for the install-config (`cp_pull_secret`, `cp_ssh_pub_key`)

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `present` | `present`/`absent` · `configure` · `install`/`destroy` · `add_node`/`remove_node` · `backup`/`restore` · `upgrade` · `status`. Shared across all distros; the dispatcher passes it in. |
| `cp_ocp_version` | `""` | OKD release tag used in the GitHub download URLs. |
| `cp_cluster_name` | `okd` | Cluster name (console/API URLs, install-config). |
| `cp_base_domain` | `example.com` | Cluster base DNS domain (console/API URLs, install-config). |
| `cp_pull_secret` | `""` | Registry pull secret for the install-config. |
| `cp_ssh_pub_key` | `""` | SSH public key injected into cluster nodes via install-config. |
| `cp_install_dir` | `/opt/openshift-install` | Installer working directory. |
| `cp_backup_dir` / `cp_restore_dir` | `/var/backup/etcd` | etcd backup / restore directories. |
| `cp_node_machineset` | `""` | MachineSet to scale for `add_node` / `remove_node`. |
| `cp_node_replicas` | `1` | Replica count when scaling in `add_node`. |
| `cp_upgrade_version` | `""` | Target upgrade version; empty = `--to-latest`. |
| `cp_install_execute` | `false` | Must be `true` to run `openshift-install create cluster`. |
| `cp_destroy_confirm` | `false` | Must be `true` to run `openshift-install destroy cluster`. |

## Use Cases

**Standalone — stage the installer binaries and open firewall ports:**

```yaml
- hosts: okd_installer
  roles:
    - role: okd
      vars:
        action: present
        cp_ocp_version: "4.15.0-0.okd-2024-01-01-000000"
```

**Standalone — render the install-config:**

```yaml
- hosts: okd_installer
  roles:
    - role: okd
      vars:
        action: configure
        cp_cluster_name: lab
        cp_base_domain: okd.example.com
        cp_pull_secret: "{{ vault_okd_pull_secret }}"
        cp_ssh_pub_key: "{{ vault_okd_ssh_key }}"
```

**Standalone — run the install (gated):**

```yaml
- hosts: okd_installer
  roles:
    - role: okd
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
        cp_type: okd
```

## Testing

```bash
cd roles/okd && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario is a control-host contract converge (`hosts: localhost`,
`gather_facts: false`): it loads defaults via `include_vars`, runs the argument-spec
negative test (bogus action), asserts the standalone default contract, and stats that each
dispatch task file exists. It validates argument-spec enforcement, action dispatch, the
shared variable contract, the install fail-closed gate, and the negative (bad-action) path
— without downloading binaries or creating a cluster. A real OKD install (the
`install`/`configure` actions) requires an installer host + infrastructure and is
exercised in the full-stack test lab, not in molecule.

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
  dispatching the action, which needs an installer host + infrastructure.

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/okd.md`](../../docs/okd.md) — internals, workflows, permutations, gotchas.
- Family index: [`docs/container-platform.md`](../../docs/container-platform.md) — the
  Kubernetes-distro family and the shared `cp_*` interface.
- Sibling distros: `k3s`, `rke2`, `ocp`.
- Dispatcher: `container_platform` (`cp_type`).
