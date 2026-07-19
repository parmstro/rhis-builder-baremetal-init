# storage_longhorn

## Description

Deploys [Longhorn](https://longhorn.io/) distributed block storage on a Kubernetes cluster
via Helm and (optionally) sets it as the cluster's default `StorageClass`. Longhorn gives a
cluster replicated, node-local persistent volumes with snapshots and backups — a good fit
for K3s/RKE2 clusters that have no external storage array.

This is a **product role** (one of the storage backends: `storage_local_path`, `storage_nfs`,
`storage_longhorn`, `storage_ocs`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `container_platform` dispatcher** when
`cp_storage_type: longhorn`. Every storage backend consumes the **same variable interface**
(`action`, `cp_storage_*`, `cp_kubeconfig_path`), so the dispatcher selects any of them with
one identical call and no per-backend code.

## Requirements

- Ansible: 2.15+ · Collection: `kubernetes.core` (Helm + k8s modules)
- A reachable Kubernetes cluster and a kubeconfig (`cp_kubeconfig_path`)
- Cluster nodes able to install `open-iscsi`, `nfs-utils`, `util-linux` (Longhorn prereqs)
- `helm` available to the controller (provided by `kubernetes.core`)

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `storage` | `storage` (deploy) · `present` (alias) · `absent` (remove). Shared across all storage backends; the dispatcher passes it in. |
| `cp_kubeconfig_path` | `/etc/rancher/k3s/k3s.yaml` | Path to the cluster kubeconfig. Shared interface var. |
| `cp_storage_make_default` | `true` | Make Longhorn the default `StorageClass`. Shared interface var. |
| `cp_storage_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the node/cluster. |
| `cp_storage_longhorn_data_path` | `/var/lib/longhorn` | Longhorn on-node data directory. |
| `cp_storage_longhorn_replicas` | `3` | Default volume replica count. |
| `storage_longhorn_namespace` | `longhorn-system` | Namespace for the Longhorn release. |

## Use Cases

**Standalone — deploy Longhorn onto an existing cluster:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: storage_longhorn
      vars:
        action: storage
        cp_kubeconfig_path: /etc/rancher/k3s/k3s.yaml
        cp_storage_longhorn_replicas: 2
```

**Standalone — remove Longhorn:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: storage_longhorn
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
        cp_storage_type: longhorn
        cp_storage_longhorn_replicas: 3
```

## Testing

```bash
cd roles/storage_longhorn && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_storage_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live Kubernetes cluster. A real Longhorn deployment requires an actual
cluster and is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9 control node; any conformant Kubernetes cluster (validated on K3s/RKE2).
License: MIT.

## Related Information

- Depth doc: [`docs/storage_longhorn.md`](../../docs/storage_longhorn.md) — internals,
  deploy/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-storage.md`](../../docs/container-storage.md) — the storage
  backend family and the shared `cp_*` interface.
- Sibling backends: `storage_local_path`, `storage_nfs`, `storage_ocs`.
- Dispatcher: `container_platform` (`cp_storage_type`).
