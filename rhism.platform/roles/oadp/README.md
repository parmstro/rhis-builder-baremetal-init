# oadp

## Description

Installs and operates [OpenShift API for Data Protection (OADP)](https://docs.redhat.com/en/documentation/openshift_container_platform/latest/html/backup_and_restore/oadp-application-backup-and-restore)
— the Red Hat-supported, [Velero](https://velero.io/)-based operator for application-level
backup and restore on OpenShift/Kubernetes. The role installs the operator via OLM, configures
the whole Velero stack through the **DataProtectionApplication** (DPA) CR (OpenShift/CSI/kubevirt
plugins + node-agent for filesystem backup), and drives the Velero **Backup / Schedule / Restore**
lifecycle.

This is a **backup product role**, and it is **standalone-first** — runnable on its own in a
playbook — and also **selected by the `backup_management` dispatcher** when `backup_type: oadp`.
A site picks **one** backup product — `oadp` (Kubernetes/OpenShift application backup via Velero),
`bareos` (director/daemon enterprise architecture), or `restic` (agentless decentralised
snapshots). Every backup product consumes the **same `backup_*` variable interface**, so the
dispatcher selects any of them with one identical call that passes only `action`, and every
`backup_oadp_*` value flows straight through. The role ships defaults for all of them, so it also
runs standalone.

OADP is built on **unmodified upstream Velero** — the `Backup`, `Restore`, `Schedule`,
`BackupStorageLocation`, and `VolumeSnapshotLocation` CRs are stock Velero. OADP adds the
`DataProtectionApplication` operator CR that installs and configures the stack, plus the OpenShift
plugins.

## Requirements

- Ansible: 2.15+ · Collections: `kubernetes.core` (k8s / k8s_info)
- **A real OpenShift cluster with OLM** and cluster-admin access for functional use — the operator
  is installed from an OperatorHub CatalogSource (`redhat-operators`).
- **Reachable S3-compatible object storage** (AWS S3, MinIO, ODF/NooBaa) for the
  BackupStorageLocation, plus its credentials (provided as the `cloud-credentials` Secret).
- A CSI driver with VolumeSnapshotClass (for CSI volume snapshots) and/or the node-agent for
  filesystem (Kopia/Restic) backup.
- A working kube context — either in-cluster, `KUBECONFIG`, or `backup_oadp_kubeconfig`.

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `verify` | Lifecycle action (see table below). Bare shared var; the dispatcher passes it in. |
| `backup_oadp_kubeconfig` | `""` | kubeconfig path; empty = ambient kube context. |
| `backup_oadp_namespace` | `openshift-adp` | Namespace all OADP/Velero resources live in. |
| `backup_oadp_wait` / `_wait_timeout` | `true` / `600` | Wait for readiness; timeout in seconds. |
| `backup_oadp_operator_package` | `redhat-oadp-operator` | OLM package name. |
| `backup_oadp_operator_channel` / `_source` / `_source_namespace` | `stable` / `redhat-operators` / `openshift-marketplace` | Subscription channel + CatalogSource. |
| `backup_oadp_operator_group_name` | `oadp-operator-group` | OperatorGroup name. |
| `backup_oadp_dpa_name` | `dpa-sample` | DataProtectionApplication CR name. |
| `backup_oadp_default_plugins` | `[aws, openshift, csi]` | Velero defaultPlugins (always includes `openshift`). |
| `backup_oadp_node_agent_enable` / `_node_agent_uploader_type` | `true` / `kopia` | node-agent filesystem backup (kopia/restic). |
| `backup_oadp_provider` | `aws` | Velero storage provider (aws = any S3-compatible store). |
| `backup_oadp_bucket` / `_prefix` | `""` / `velero` | Object-store bucket and key prefix. |
| `backup_oadp_region` | `us-east-1` | Object-store region. |
| `backup_oadp_s3_url` / `_s3_force_path_style` | `""` / `false` | MinIO/ODF endpoint URL + path-style addressing. |
| `backup_oadp_insecure_skip_tls_verify` | `false` | Skip TLS verification of the object store. |
| `backup_oadp_credential_secret` / `_credential_key` | `cloud-credentials` / `cloud` | Object-store credentials Secret + key. |
| `backup_oadp_cloud_credentials` | `""` | Raw credentials-file content (vault-backed); empty = provisioned out of band. |
| `backup_oadp_snapshot_location_enabled` / `_snapshot_provider` / `_snapshot_region` | `false` / `aws` / `us-east-1` | Optional VolumeSnapshotLocation. |
| `backup_oadp_client_namespace` / `_client_labels` / `_client_annotations` | `""` / `{}` / `{}` | App namespace enablement (`client`). |
| `backup_oadp_backup_name` | `""` | On-demand Backup name (`backup`). |
| `backup_oadp_included_namespaces` / `_included_resources` | `[]` / `['*']` | Backup/Schedule scope. |
| `backup_oadp_label_selector` | `{}` | matchLabels selector; empty = all. |
| `backup_oadp_snapshot_volumes` / `_default_volumes_to_fs_backup` | `true` / `false` | Volume snapshot / filesystem-backup toggles. |
| `backup_oadp_ttl` / `_storage_location` | `720h0m0s` / `default` | Backup retention (30d) + target BSL. |
| `backup_oadp_schedule_name` / `_schedule_cron` / `_schedule_paused` / `_schedule_ttl` | `""` / `0 1 * * *` / `false` / `720h0m0s` | Schedule params (`schedule`). |
| `backup_oadp_restore_name` / `_restore_backup_name` | `""` / `""` | Restore name + source Backup (`restore`). |
| `backup_oadp_restore_namespace_mapping` / `_restore_pvs` / `_restore_existing_policy` | `{}` / `true` / `none` | Restore remapping, PV restore, existing-resource policy. |
| `backup_oadp_apply_server` / `_apply_schedule` / `_apply_verify` | `true` / `false` / `true` | `baseline` stage gates. |

### Actions (`action`)

| Action | Effect |
|---|---|
| `server` | Install the OADP operator (Namespace → OperatorGroup → Subscription → wait CSV Succeeded) and apply the DataProtectionApplication (Velero + node-agent + plugins + default BackupStorageLocation); wait BSL Available. |
| `client` | Enable an application namespace for backup (labels/annotations). Thin — OADP is agentless server-side. |
| `backup` | Create an on-demand Velero `Backup` CR; wait `Completed`. |
| `schedule` | Apply a Velero `Schedule` CR (recurring Backups on a cron). |
| `restore` | Apply a Velero `Restore` CR from a named Backup; wait `Completed`. |
| `verify` | Read-only: assert BackupStorageLocation `Available`, Velero/node-agent pods `Running`, and (if named) a Backup `Completed`. |
| `baseline` | Orchestrate `server` → `schedule` → `verify`, each gated on a `backup_oadp_apply_*` boolean. |

## Use Cases

**Standalone — install OADP and configure the Velero stack against MinIO/ODF:**

```yaml
- hosts: localhost
  roles:
    - role: oadp
      vars:
        action: server
        backup_oadp_bucket: velero-backups
        backup_oadp_s3_url: https://minio.apps.example.com
        backup_oadp_s3_force_path_style: true
        backup_oadp_cloud_credentials: "{{ vault_oadp_cloud_credentials }}"
```

**Standalone — schedule a nightly namespaced backup:**

```yaml
- hosts: localhost
  roles:
    - role: oadp
      vars:
        action: schedule
        backup_oadp_schedule_name: nightly-apps
        backup_oadp_schedule_cron: "0 1 * * *"
        backup_oadp_included_namespaces: [team-a, team-b]
        backup_oadp_default_volumes_to_fs_backup: true
```

**Standalone — restore an app namespace into a new namespace:**

```yaml
- hosts: localhost
  roles:
    - role: oadp
      vars:
        action: restore
        backup_oadp_restore_name: team-a-restore
        backup_oadp_restore_backup_name: nightly-apps-20260716010000
        backup_oadp_restore_namespace_mapping: {team-a: team-a-dr}
```

**Via the `backup_management` dispatcher** (same play selects any backup product; the
`backup_oadp_*` vars flow straight through):

```yaml
- hosts: localhost
  roles:
    - role: backup_management
      vars:
        backup_action: server
        backup_type: oadp
        backup_oadp_bucket: velero-backups
        backup_oadp_cloud_credentials: "{{ vault_oadp_cloud_credentials }}"
```

## Testing

```bash
cd roles/oadp && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario is a **Tier-1 contract converge** (`hosts: localhost`,
`gather_facts: false`): it loads defaults via `include_vars`, runs the argument-spec negative
test (bogus action), asserts the shared `backup_oadp_*` default contract, renders a Velero Backup
CR client-side and asserts its structure, and stats that each dispatch task file exists. It
validates argument-spec enforcement, action dispatch, the shared variable contract, and the
negative path — **without an OpenShift cluster, OLM, or object storage**.

**Functional OADP is Tier-3-lab-only, by design.** OADP genuinely cannot run in a plain CI
container: it needs a real OpenShift cluster with OLM (to install the operator), a CSI driver /
node-agent, and reachable S3-compatible object storage (to actually store a backup). Real effect —
operator installs, a backup lands in the bucket, a restore recreates workloads — is exercised in
the external test lab (OCP + MinIO), the same boundary the platform draws for `k3s`/`rke2`/`ocp`
and the `aap`/AAP-operator roles. See `docs/oadp.md` for the lab procedure.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-16) |

### Bugfixes

- None yet — role created 2026-07-16.

## Support / License

Platforms: EL9 (control node). Target: OpenShift 4.x / Kubernetes. License: MIT.

## Related Information

- Depth doc: [`docs/oadp.md`](../../docs/oadp.md) — DPA architecture, the operator install flow,
  Velero CR lifecycle, uploader/plugin permutations, and the Tier-3 lab procedure.
- Family index: [`docs/backup-management.md`](../../docs/backup-management.md) — the backup product
  family and the shared `backup_*` interface.
- Sibling products: `bareos`, `restic`.
- Dispatcher: `backup_management` (`backup_type`).
