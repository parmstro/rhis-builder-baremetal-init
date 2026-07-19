# rke2

## Description

Installs and manages [RKE2](https://docs.rke2.io/) (Rancher's Government-focused, FIPS-capable
Kubernetes distribution) on EL9 nodes. The role installs a server (control plane) or an agent
(worker), deploys the node config, manages the service, joins/evicts worker nodes, performs
in-place upgrades, takes and restores etcd snapshots, and tears the node down.

This is a **Kubernetes-distro product role** (one of `k3s`, `rke2`, `okd`, `ocp`). It is
**standalone-first** — runnable on its own in a playbook — and is also **selected by the
`container_platform` dispatcher** when `cp_type: rke2`. Every distro consumes the **same
variable interface** (bare `action`, `cp_*` vars), so the dispatcher selects any of them with
one identical call and no per-distro code.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld)
- EL9 node(s) with outbound access to `https://get.rke2.io` and internet for the installer
- `curl` on the target; `become` (root) for install/service/firewall operations
- For worker joins: reachable `cp_server_url` and a valid `cp_node_token`

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `present` | `present`/`absent` · `configure` · `started`/`stopped`/`restarted` · `add_node`/`remove_node` · `upgrade` · `backup`/`restore` · `reset` · `status`. Shared across all distros; the dispatcher passes it in. |
| `cp_node_role` | `control_plane` | `control_plane` (rke2-server) or `worker` (rke2-agent). Shared interface var. |
| `cp_install_version` | `""` | RKE2 version pin (`INSTALL_RKE2_VERSION`); empty = latest. |
| `cp_server_url` | `""` | Server join URL written to the agent config for a worker / `add_node`. |
| `cp_node_token` | `""` | Cluster join token written to the agent config for a worker / `add_node`. |
| `cp_kubeconfig_path` | `/etc/rancher/rke2/rke2.yaml` | Standard-path kubeconfig symlink target. Shared interface var. |
| `cp_backup_snapshot_name` | `{{ inventory_hostname }}-rke2` | Name for the etcd snapshot in `backup`. |
| `cp_restore_snapshot_name` | `""` | etcd snapshot to restore in `restore`. |
| `cp_reset_confirm` | `false` | Must be `true` to run the destructive `reset` teardown. |

## Use Cases

**Standalone — install an RKE2 control-plane node:**

```yaml
- hosts: k8s_servers
  roles:
    - role: rke2
      vars:
        action: present
        cp_node_role: control_plane
```

**Standalone — join a worker node:**

```yaml
- hosts: k8s_workers
  roles:
    - role: rke2
      vars:
        action: add_node
        cp_node_role: worker
        cp_server_url: https://rke2-server:9345
        cp_node_token: "{{ vault_rke2_token }}"
```

**Standalone — take an etcd snapshot:**

```yaml
- hosts: k8s_servers
  roles:
    - role: rke2
      vars: { action: backup }
```

**Via the `container_platform` dispatcher** (same code selects any distro):

```yaml
- hosts: k8s_cluster
  roles:
    - role: container_platform
      vars:
        cp_action: install
        cp_type: rke2
```

## Testing

```bash
cd roles/rke2 && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario is a control-host contract converge (`hosts: localhost`,
`gather_facts: false`): it loads defaults via `include_vars`, runs the argument-spec
negative test (bogus action), asserts the standalone default contract, and stats that each
dispatch task file exists. It validates argument-spec enforcement, action dispatch, the
shared variable contract, and the negative (bad-action) path without installing RKE2 or
touching services. A real RKE2 install (the `install`/`configure` cluster actions) requires
an actual EL9 node and is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

- `configure` renders `templates/rke2-config.yaml.j2` (added 2026-07-01). Molecule does not
  exercise `configure` — the contract converge stats the dispatch task file rather than
  dispatching the action, which needs a real EL9 node.

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/rke2.md`](../../docs/rke2.md) — internals, workflows, permutations, gotchas.
- Family index: [`docs/container-platform.md`](../../docs/container-platform.md) — the
  Kubernetes-distro family and the shared `cp_*` interface.
- Sibling distros: `k3s`, `okd`, `ocp`.
- Dispatcher: `container_platform` (`cp_type`).
