# storage_nfs

## Description

Deploys the [NFS subdir external provisioner](https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner)
on a Kubernetes cluster via Helm, backed by an existing NFS export, and (optionally) sets its
`StorageClass` as the cluster default. Each PVC is provisioned as a subdirectory of the shared
NFS export, giving cheap ReadWriteMany-capable shared storage without a storage array.

This is a **product role** (one of the storage backends: `storage_local_path`, `storage_nfs`,
`storage_longhorn`, `storage_ocs`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `container_platform` dispatcher** when
`cp_storage_type: nfs`. Every storage backend consumes the **same variable interface**
(`action`, `cp_storage_*`, `cp_kubeconfig_path`), so the dispatcher selects any of them with
one identical call and no per-backend code.

## Requirements

- Ansible: 2.15+ · Collection: `kubernetes.core` (Helm + k8s modules)
- A reachable Kubernetes cluster and a kubeconfig (`cp_kubeconfig_path`)
- An existing NFS server + export reachable from every cluster node
  (`cp_storage_nfs_server`, `cp_storage_nfs_path`)
- Cluster nodes able to install `nfs-utils`

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `storage` | `storage` (deploy) · `present` (alias) · `absent` (remove). Shared across all storage backends; the dispatcher passes it in. |
| `cp_kubeconfig_path` | `/etc/rancher/k3s/k3s.yaml` | Path to the cluster kubeconfig. Shared interface var. |
| `cp_storage_make_default` | `false` | Make the NFS StorageClass the default. Shared interface var. |
| `cp_storage_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the node/cluster. |
| `cp_storage_nfs_server` | `""` | NFS server host/IP. **Required** for a real deploy (asserted non-empty when executing). |
| `cp_storage_nfs_path` | `""` | Exported NFS path. **Required** for a real deploy (asserted non-empty when executing). |
| `cp_storage_class_name` | `nfs-client` | Name of the StorageClass created by the provisioner. |
| `cp_storage_nfs_reclaim_policy` | `Delete` | PV reclaim policy. |
| `cp_storage_nfs_archive_on_delete` | `false` | Archive released PV data instead of deleting it. |

## Use Cases

**Standalone — deploy the NFS provisioner against an existing export:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: storage_nfs
      vars:
        action: storage
        cp_kubeconfig_path: /etc/rancher/k3s/k3s.yaml
        cp_storage_nfs_server: 192.168.100.10
        cp_storage_nfs_path: /export/k8s
        cp_storage_make_default: true
```

**Standalone — remove the NFS provisioner:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: storage_nfs
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
        cp_storage_type: nfs
        cp_storage_nfs_server: 192.168.100.10
        cp_storage_nfs_path: /export/k8s
```

## Testing

```bash
cd roles/storage_nfs && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_storage_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live Kubernetes cluster or NFS server. A real NFS deployment requires an
actual cluster and export and is exercised in the full-stack test lab, not in molecule.

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

- Depth doc: [`docs/storage_nfs.md`](../../docs/storage_nfs.md) — internals,
  deploy/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-storage.md`](../../docs/container-storage.md) — the storage
  backend family and the shared `cp_*` interface.
- Sibling backends: `storage_local_path`, `storage_longhorn`, `storage_ocs`.
- Dispatcher: `container_platform` (`cp_storage_type`).
