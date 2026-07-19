# storage_ocs

## Description

Deploys [OpenShift Data Foundation](https://www.redhat.com/en/technologies/cloud-computing/openshift-data-foundation)
(ODF, formerly OpenShift Container Storage / OCS) on an OCP/OKD cluster. It installs the ODF
operator via an OLM subscription and creates a `StorageCluster` custom resource, giving the
cluster Ceph-backed block, file, and object storage — the storage backend for large-scale,
production OpenShift.

This is a **product role** (one of the storage backends: `storage_local_path`, `storage_nfs`,
`storage_longhorn`, `storage_ocs`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `container_platform` dispatcher** when
`cp_storage_type: ocs`. Every storage backend consumes the **same variable interface**
(`action`, `cp_storage_*`, `cp_kubeconfig_path`), so the dispatcher selects any of them with
one identical call and no per-backend code.

## Requirements

- Ansible: 2.15+ · Collection: `kubernetes.core` (k8s + k8s_info modules)
- An OCP or OKD cluster (`cp_type: ocp` or `okd`) and a kubeconfig (`cp_kubeconfig_path`)
- Red Hat subscription with an ODF/OCS entitlement (for OCP `redhat-operators` catalog)
- Worker nodes with dedicated block devices for the OCS device sets

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `storage` | `storage` (deploy) · `present` (alias) · `absent` (remove). Shared across all storage backends; the dispatcher passes it in. |
| `cp_kubeconfig_path` | `/root/.kube/config` | Path to the cluster kubeconfig. Shared interface var. |
| `cp_type` | `ocp` | Container platform type. Must be `ocp` or `okd` (asserted on deploy). |
| `cp_storage_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the cluster. |
| `cp_ocs_install_execute` | `false` | **OCS-specific hard gate** — set `true` to actually install the ODF OLM operator (prevents accidental cluster-wide installs). |
| `cp_storage_ocs_size` | `500Gi` | Storage request per OCS device set. |
| `cp_storage_ocs_storage_class` | `gp2` | Underlying StorageClass backing the device sets. |

## Use Cases

**Standalone — deploy ODF onto an OpenShift cluster** (note the two gates):

```yaml
- hosts: openshift_installer
  roles:
    - role: storage_ocs
      vars:
        action: storage
        cp_type: ocp
        cp_kubeconfig_path: /root/.kube/config
        cp_ocs_install_execute: true      # hard gate — required to install
        cp_storage_ocs_size: 1Ti
        cp_storage_ocs_storage_class: managed-premium
```

**Standalone — remove ODF:**

```yaml
- hosts: openshift_installer
  roles:
    - role: storage_ocs
      vars:
        action: absent
        cp_type: ocp
        cp_ocs_install_execute: true
```

**Via the `container_platform` dispatcher** (same code selects any backend):

```yaml
- hosts: openshift_installer
  roles:
    - role: container_platform
      vars:
        cp_action: storage
        cp_type: ocp
        cp_storage_type: ocs
        cp_ocs_install_execute: true
```

## Testing

```bash
cd roles/storage_ocs && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_storage_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live OpenShift cluster. A real ODF deployment requires an actual OCP/OKD
cluster with ODF entitlement and is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

- **BUG-038** — the kubeconfig default was `/usr/local/bin/oc` (the `oc` binary path, not a
  kubeconfig). Latent while the dispatcher always passed `cp_kubeconfig_path`; surfaced when
  the role became standalone-first. Fixed to a sane default of `/root/.kube/config` in
  `defaults/main.yml` and `meta/argument_specs.yml`.

## Support / License

Platforms: EL9 control node; OCP/OKD cluster with ODF/OCS entitlement.
License: MIT.

## Related Information

- Depth doc: [`docs/storage_ocs.md`](../../docs/storage_ocs.md) — internals,
  deploy/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-storage.md`](../../docs/container-storage.md) — the storage
  backend family and the shared `cp_*` interface.
- Sibling backends: `storage_local_path`, `storage_nfs`, `storage_longhorn`.
- Dispatcher: `container_platform` (`cp_storage_type`).
