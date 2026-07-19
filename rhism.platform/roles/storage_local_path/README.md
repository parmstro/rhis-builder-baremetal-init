# storage_local_path

## Description

Configures the [K3s built-in local-path](https://github.com/rancher/local-path-provisioner)
`StorageClass` on a Kubernetes cluster and (optionally) makes it the cluster's default
`StorageClass`. `local-path` provisions node-local `hostPath` volumes with no external
dependencies — the simplest possible persistent storage, ideal for single-node and dev/test
clusters.

This is a **product role** (one of the storage backends: `storage_local_path`, `storage_nfs`,
`storage_longhorn`, `storage_ocs`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `container_platform` dispatcher** when
`cp_storage_type: local-path`. Every storage backend consumes the **same variable interface**
(`action`, `cp_storage_*`, `cp_kubeconfig_path`), so the dispatcher selects any of them with
one identical call and no per-backend code.

## Requirements

- Ansible: 2.15+ · Collection: `kubernetes.core` (k8s + k8s_info modules)
- A reachable Kubernetes cluster and a kubeconfig (`cp_kubeconfig_path`)
- A K3s cluster with the local-path-provisioner running (installed automatically by K3s)

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `storage` | `storage` (configure) · `present` (alias) · `absent` (informational). Shared across all storage backends; the dispatcher passes it in. |
| `cp_kubeconfig_path` | `/etc/rancher/k3s/k3s.yaml` | Path to the cluster kubeconfig. Shared interface var. |
| `cp_storage_make_default` | `true` | Make local-path the default `StorageClass`. Shared interface var. |
| `cp_storage_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the node/cluster. |

## Use Cases

**Standalone — make local-path the default StorageClass on an existing cluster:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: storage_local_path
      vars:
        action: storage
        cp_kubeconfig_path: /etc/rancher/k3s/k3s.yaml
        cp_storage_make_default: true
```

**Standalone — local-path removal (informational only):**

```yaml
- hosts: k8s_cluster
  roles:
    - role: storage_local_path
      vars: { action: absent }
```

**Via the `container_platform` dispatcher** (same code selects any backend):

```yaml
- hosts: k8s_cluster
  roles:
    - role: container_platform
      vars:
        cp_action: storage
        cp_type: k3s
        cp_storage_type: local-path
```

## Testing

```bash
cd roles/storage_local_path && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_storage_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live Kubernetes cluster.

The `functional` scenario (Tier 2) brings up a **real single-node k3s cluster** in a
privileged AlmaLinux 9 container under rootless podman, runs the role against it, and
asserts the goal: `local-path` is present and marked the cluster-default StorageClass. It
uses the zero-exposure rootless recipe documented in
[`docs/k3s-rootless-podman-research.md`](../../docs/k3s-rootless-podman-research.md).

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |
| functional | almalinux9 (real k3s cluster, rootless podman) | Pass (2026-07-02) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9 control node; any conformant Kubernetes cluster (validated on K3s).
License: MIT.

## Related Information

- Depth doc: [`docs/storage_local_path.md`](../../docs/storage_local_path.md) — internals,
  deploy/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-storage.md`](../../docs/container-storage.md) — the storage
  backend family and the shared `cp_*` interface.
- Sibling backends: `storage_nfs`, `storage_longhorn`, `storage_ocs`.
- Dispatcher: `container_platform` (`cp_storage_type`).
