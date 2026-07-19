# restic

## Description

Installs and operates the [restic](https://restic.net/) backup client. It initialises an
**encrypted, deduplicated** repository (local path, SFTP, S3, B2, REST server, rclone, …),
deploys backup/restore helper scripts and a cron schedule, and drives the full snapshot
lifecycle: `backup`, `restore`, `forget` (retention), `prune`, `snapshots`, `verify` (repo
check), and `unlock`.

This is a **backup product role**. A site picks **one** backup product — `restic` (agentless,
decentralised, snapshot-based) or `bareos` (director/daemon enterprise architecture). The role
is **standalone-first** — runnable on its own in a playbook — and is also **selected by the
`backup_management` dispatcher** when `backup_type: restic`. Every backup product consumes the
**same `backup_*` variable interface**, so the dispatcher selects any of them with one
identical call that passes only `action`, and every `backup_restic_*` value flows straight
through. The role ships defaults for all of them, so it also runs standalone.

## Requirements

- Ansible: 2.15+ · Collection: `ansible.posix` (cron)
- `restic` available from the host package repos (installed by the role)
- A repository backend reachable from the host and its password
  (`backup_restic_repository`, `backup_restic_password`) for any action that touches the
  repository
- For cloud backends, the relevant credentials supplied via `backup_restic_env`

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `client` | Lifecycle action (see table below). Bare shared var; the dispatcher passes it in. |
| `backup_restic_repository` | `""` | Repository location — local path, `sftp:`, `s3:`, `b2:`, `rest:`, `rclone:`, … |
| `backup_restic_password` | `""` | Repository password (vault-backed); encrypts the whole repository. |
| `backup_restic_paths` | `[/etc, /home, /root, /var/log]` | Directories to back up. |
| `backup_restic_exclude_patterns` | `[/proc, /sys, /dev, /run, *.sock, *.pid]` | Exclude patterns. |
| `backup_restic_extra_args` | `""` | Extra args appended to `restic backup` (role-only). |
| `backup_restic_retention_daily` / `_weekly` / `_monthly` / `_yearly` | `7` / `4` / `12` / `1` | Retention policy for the `forget` action. |
| `backup_restic_restore_snapshot` | `latest` | Snapshot ID (or `latest`) to restore. |
| `backup_restic_restore_path` | `/var/restore` | Restore output directory. |
| `backup_restic_env` | `{}` | Extra env vars for cloud backends (AWS/B2 keys, etc.). |
| `backup_restic_cron_enabled` | `true` | Manage the backup cron job (`schedule` action). |
| `backup_restic_cron_hour` / `_minute` / `_user` | `2` / `0` / `root` | Cron schedule fields. |
| `backup_restic_script_dir` | `/usr/local/bin` | Where the helper scripts are deployed. |

### Actions (`action`)

| Action | Effect |
|---|---|
| `server` | Install restic + initialise the repository on the storage host. |
| `client` | Install restic, configure the repository, deploy helper scripts (default). |
| `present` / `absent` | Manage the `restic` package. |
| `configure` | Deploy the env file and (idempotently) `restic init` the repository. |
| `backup` | Run a `restic backup` of `backup_restic_paths`. |
| `restore` | Restore `backup_restic_restore_snapshot` into `backup_restic_restore_path`. |
| `forget` | Apply the retention policy and prune. |
| `prune` | Remove unreferenced data from the repository. |
| `snapshots` | List snapshots. |
| `verify` | `restic check` — repository integrity. |
| `unlock` | Remove stale repository locks. |
| `schedule` | Manage the cron job that runs the backup script. |
| `deploy_scripts` | Write the backup/restore helper scripts only. |

## Use Cases

**Standalone — install a client and take a backup** (set the `backup_restic_*` interface
directly):

```yaml
- hosts: backup_clients
  roles:
    - role: restic
      vars:
        action: client
        backup_restic_repository: "s3:s3.amazonaws.com/mybucket/{{ inventory_hostname }}"
        backup_restic_password: "{{ vault_restic_password }}"
        backup_restic_env:
          AWS_ACCESS_KEY_ID: "{{ vault_aws_key }}"
          AWS_SECRET_ACCESS_KEY: "{{ vault_aws_secret }}"

- hosts: backup_clients
  roles:
    - role: restic
      vars: { action: backup }
```

**Standalone — apply retention and verify:**

```yaml
- hosts: backup_clients
  roles:
    - role: restic
      vars: { action: forget }
    - role: restic
      vars: { action: verify }
```

**Via the `backup_management` dispatcher** (same play selects either backup product; the
`backup_restic_*` vars flow straight through):

```yaml
- hosts: backup_clients
  roles:
    - role: backup_management
      vars:
        backup_action: client
        backup_type: restic
        backup_restic_repository: "sftp:backup@vault:/srv/restic/{{ inventory_hostname }}"
        backup_restic_password: "{{ vault_restic_password }}"
```

## Testing

```bash
cd roles/restic && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario is a control-host contract converge (`hosts: localhost`,
`gather_facts: false`): it loads defaults via `include_vars`, runs the argument-spec negative
test (bogus action), asserts the standalone default contract, and stats that each dispatch
task file exists. It validates argument-spec enforcement, action dispatch, the shared variable
contract, and the negative (bad-action) path — without installing restic or touching a
repository. A real backup/restore is exercised in the full-stack test lab
(`inventories/test/`), not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

- Helper templates (`backup.sh.j2`, `restore.sh.j2`) and the missing `restic-env.j2` were the
  only files that referenced the shared `backup_restic_*` family names; every task read
  role-prefixed `restic_*` names the dispatcher never set — so the dispatched path ran with an
  empty repository/password and `configure` failed on the missing template. Standardised the
  whole role on the `backup_restic_*` family interface and added the missing `restic-env.j2`, so
  both standalone and dispatched paths resolve the same variables.

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/restic.md`](../../docs/restic.md) — internals, action lifecycle,
  repository backends, and gotchas.
- Family index: [`docs/backup-management.md`](../../docs/backup-management.md) — the backup
  product family and the shared `backup_*` interface.
- Sibling product: `bareos`.
- Dispatcher: `backup_management` (`backup_type`).
