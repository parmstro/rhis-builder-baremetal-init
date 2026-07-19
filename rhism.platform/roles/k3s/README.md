# k3s

## Description

Installs and manages [K3s](https://k3s.io/), Rancher's lightweight CNCF-conformant
Kubernetes distribution, on EL9 nodes. The role installs a server (control plane) or an
agent (worker), deploys the node config, manages the service, joins/evicts worker nodes,
performs in-place upgrades, takes and restores etcd snapshots, and tears the node down.

This is a **Kubernetes-distro product role** (one of `k3s`, `rke2`, `okd`, `ocp`). It is
**standalone-first** — runnable on its own in a playbook — and is also **selected by the
`container_platform` dispatcher** when `cp_type: k3s`. Every distro consumes the **same
variable interface** (bare `action`, `cp_*` vars), so the dispatcher selects any of them
with one identical call and no per-distro code.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld)
- EL9 node(s) with outbound access to `https://get.k3s.io` and internet for the installer
- `curl` on the target; `become` (root) for install/service/firewall operations
- For worker joins: reachable `cp_server_url` and a valid `cp_node_token`

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `present` | `present`/`absent` · `configure` · `started`/`stopped`/`restarted` · `add_node`/`remove_node` · `upgrade` · `backup`/`restore` · `reset` · `status`. Shared across all distros; the dispatcher passes it in. |
| `cp_node_role` | `control_plane` | `control_plane` (K3s server) or `worker` (K3s agent). Shared interface var. |
| `cp_install_version` | `""` | K3s version pin (`INSTALL_K3S_VERSION`); empty = stable channel. |
| `cp_server_url` | `""` | Server join URL (`K3S_URL`) for a worker / `add_node`. |
| `cp_node_token` | `""` | Cluster join token (`K3S_TOKEN`) for a worker / `add_node`. |
| `cp_kubeconfig_path` | `/etc/rancher/k3s/k3s.yaml` | Standard-path kubeconfig symlink target. Shared interface var. |
| `cp_backup_snapshot_name` | `{{ inventory_hostname }}-k3s` | Name for the etcd snapshot in `backup`. |
| `cp_restore_snapshot_name` | `""` | etcd snapshot to restore in `restore`. |
| `cp_reset_confirm` | `false` | Must be `true` to run the destructive `reset` teardown. |

## Use Cases

**Standalone — install a K3s control-plane node:**

```yaml
- hosts: k8s_servers
  roles:
    - role: k3s
      vars:
        action: present
        cp_node_role: control_plane
```

**Standalone — join a worker node:**

```yaml
- hosts: k8s_workers
  roles:
    - role: k3s
      vars:
        action: add_node
        cp_node_role: worker
        cp_server_url: https://k3s-server:6443
        cp_node_token: "{{ vault_k3s_token }}"
```

**Standalone — take an etcd snapshot:**

```yaml
- hosts: k8s_servers
  roles:
    - role: k3s
      vars: { action: backup }
```

**Via the `container_platform` dispatcher** (same code selects any distro):

```yaml
- hosts: k8s_cluster
  roles:
    - role: container_platform
      vars:
        cp_action: install
        cp_type: k3s
```

## Testing

```bash
cd roles/k3s && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario is a control-host contract converge (`hosts: localhost`,
`gather_facts: false`): it loads defaults via `include_vars`, runs the argument-spec
negative test (bogus action), asserts the standalone default contract, and stats that each
dispatch task file exists. It validates argument-spec enforcement, action dispatch, the
shared variable contract, and the negative (bad-action) path without installing K3s or
touching services.

The `functional` scenario (Tier 2) installs a **real single-node k3s cluster** in a
privileged AlmaLinux 9 container under rootless podman and asserts the goal: the k3s
service is active, the node reaches `Ready`, and kube-system pods exist. It runs with zero
host security relaxation via a private cgroup namespace, `cpuset` delegation, and the
`KubeletInUserNamespace` kubelet feature gate — the full recipe and experiment record is
[`docs/k3s-rootless-podman-research.md`](../../docs/k3s-rootless-podman-research.md).

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |
| functional | almalinux9 (real k3s cluster, rootless podman) | Pass (2026-07-02) |

### Bugfixes

- `configure` renders `templates/k3s-config.yaml.j2` (added 2026-07-01). Molecule does not
  exercise `configure` — the contract converge stats the dispatch task file rather than
  dispatching the action, which needs a real EL9 node.
- **BUG-041** (found by the `functional` scenario, 2026-07-02): sudo `secure_path` on EL9
  excludes `/usr/local/bin`, so every `command:` task invoking a bare `k3s` under
  `become: true` failed with rc=2 and empty output — on real hosts too (`status`,
  `remove_node`, `backup`, `restore`, `configure`). Fixed by making the shared
  `_cp_kubectl_cmd` fact absolute (`/usr/local/bin/k3s kubectl`) and consuming
  `{{ _cp_kubectl_cmd }}` / `{{ _cp_binary }}` in task files (okd/ocp `oc` fixed the same
  way; rke2 was already absolute).

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/k3s.md`](../../docs/k3s.md) — internals, workflows, permutations, gotchas.
- Family index: [`docs/container-platform.md`](../../docs/container-platform.md) — the
  Kubernetes-distro family and the shared `cp_*` interface.
- Sibling distros: `rke2`, `okd`, `ocp`.
- Dispatcher: `container_platform` (`cp_type`).
