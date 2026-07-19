# bareos

## Description

Installs and operates a [Bareos](https://www.bareos.org/) backup solution — the **Director**,
**Storage Daemon**, and **File Daemon** — and drives day-to-day operations through `bconsole`:
register clients, define jobs/filesets/schedules, run and restore jobs, verify catalog
integrity, and prune/purge volumes.

This is a **backup product role**. A site picks **one** backup product — `bareos` (a
director/daemon enterprise architecture with a central catalog) or `restic` (agentless,
decentralised snapshots). The role is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `backup_management` dispatcher** when
`backup_type: bareos`. Every backup product consumes the **same `backup_*` variable
interface**, so the dispatcher selects any of them with one identical call that passes only
`action`, and every `backup_bareos_*` value flows straight through. The role ships defaults
for all of them, so it also runs standalone.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld) · `ansible.builtin.expect`
  (bconsole sessions)
- Bareos packages available from the host repos (installed by the role)
- PostgreSQL available for the Bareos catalog (`bareos-database-postgresql`)
- `bconsole` configured (`/etc/bareos/bconsole.conf`) for the operational actions

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `server` | Lifecycle action (see table below). Bare shared var; the dispatcher passes it in. |
| `backup_bareos_director_host` / `_director_port` | fqdn / `9101` | Director address and port. |
| `backup_bareos_director_password` | `""` | Director console password (vault-backed). |
| `backup_bareos_storage_host` / `_storage_port` | fqdn / `9103` | Storage daemon address and port. |
| `backup_bareos_storage_password` | `""` | Storage daemon password (vault-backed). |
| `backup_bareos_storage_device` | `/var/lib/bareos/storage` | On-disk storage archive directory. |
| `backup_bareos_file_daemon_port` / `_file_daemon_password` | `9102` / `""` | File daemon port and password. |
| `backup_bareos_monitor_password` | `""` | Monitor console password (vault-backed). |
| `backup_bareos_max_concurrent_jobs` | `20` | Director max concurrent jobs. |
| `backup_bareos_message_retention` / `_job_retention` / `_volume_retention` | `180 days` / `12 months` / `365 days` | Retention windows. |
| `backup_bareos_client_*` | see defaults | Client registration params (`add_client`). |
| `backup_bareos_job_*` | see defaults | Job/fileset/schedule params (`add_job`, role-only). |
| `backup_bareos_run_job_name` | `""` | Job to trigger (`run_job`, role-only). |
| `backup_bareos_restore_client` / `_restore_where` | `localhost-fd` / `/var/restore` | Restore params (role-only). |
| `backup_bareos_verify_job_name` / `_verify_level` | `""` / `InitCatalog` | Verify params (role-only). |
| `backup_bareos_purge_volume` | `""` | Volume to purge; empty purges all expired jobs (role-only). |
| `backup_bareos_pools` / `_filesets` / `_schedules` / `_jobs` | `[]` | Director resource definitions rendered into `bareos-dir.conf`. |

### Actions (`action`)

| Action | Effect |
|---|---|
| `server` | Install + configure Director, Storage, and File Daemon; start all services. |
| `client` | Install + configure the File Daemon only. |
| `configure` | Re-render `bareos-dir/sd/fd.conf` and open firewall ports. |
| `schedule` | Re-render the director config (schedules + jobs). |
| `present` / `absent` | Manage Bareos packages. |
| `started` / `stopped` / `restarted` | Manage the three Bareos services. |
| `add_client` | Register a client resource via bconsole. |
| `add_job` | Define fileset + schedule + job via bconsole. |
| `run_job` | Trigger an on-demand backup job. |
| `restore` | Restore files for a client. |
| `verify` | Run a verify job against the catalog. |
| `prune` / `purge` | Prune expired volumes / purge catalog data. |
| `status` | Report director, storage, and client status. |

## Use Cases

**Standalone — stand up a full backup server** (set the `backup_bareos_*` interface directly):

```yaml
- hosts: backup_servers
  roles:
    - role: bareos
      vars:
        action: server
        backup_bareos_director_password: "{{ vault_bareos_director_pw }}"
        backup_bareos_storage_password: "{{ vault_bareos_storage_pw }}"
        backup_bareos_file_daemon_password: "{{ vault_bareos_fd_pw }}"
```

**Standalone — register a client and run its backup:**

```yaml
- hosts: backup_servers
  roles:
    - role: bareos
      vars:
        action: add_client
        backup_bareos_client_name: web01-fd
        backup_bareos_client_address: 10.0.0.21
        backup_bareos_client_password: "{{ vault_web01_fd_pw }}"
    - role: bareos
      vars: { action: run_job, backup_bareos_run_job_name: BackupWeb01 }
```

**Via the `backup_management` dispatcher** (same play selects either backup product; the
`backup_bareos_*` vars flow straight through):

```yaml
- hosts: backup_servers
  roles:
    - role: backup_management
      vars:
        backup_action: server
        backup_type: bareos
        backup_bareos_director_password: "{{ vault_bareos_director_pw }}"
```

## Testing

```bash
cd roles/bareos && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario is a control-host contract converge (`hosts: localhost`,
`gather_facts: false`): it loads defaults via `include_vars`, runs the argument-spec negative
test (bogus action), asserts the standalone default contract, and stats that each dispatch
task file exists. It validates argument-spec enforcement, action dispatch, the shared variable
contract, and the negative (bad-action) path — without installing Bareos, starting services,
or opening a bconsole session. A real director/daemon deployment is exercised in the
full-stack test lab (`inventories/test/`), not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

- The `bareos-dir/sd/fd.conf.j2` templates already read the shared `backup_bareos_*` family
  names, but every task read role-prefixed `bareos_*` names the dispatcher never set — so the
  dispatched path ran with empty passwords/ports while the templates rendered from the
  dispatcher values (or, for `bareos-fd.conf.j2`, from `backup_bareos_file_daemon_*` that the
  role never defined). Standardised the whole role on the `backup_bareos_*` family interface so
  both standalone and dispatched paths resolve the same variables.

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/bareos.md`](../../docs/bareos.md) — director/daemon architecture, bconsole
  action flow, resource rendering, and gotchas.
- Family index: [`docs/backup-management.md`](../../docs/backup-management.md) — the backup
  product family and the shared `backup_*` interface.
- Sibling product: `restic`.
- Dispatcher: `backup_management` (`backup_type`).
