# rear

## Description

Installs and operates [Relax-and-Recover (ReaR)](https://relax-and-recover.org/) — the
standard RHEL **bare-metal disaster recovery** tool. ReaR produces **two** artifacts: a
bootable **rescue image** (the OUTPUT side — how you boot a destroyed machine) and a matching
**data backup** (the BACKUP side — what is restored once booted). This role installs ReaR and
its method-matched tooling, renders the split `/etc/rear` configuration, schedules unattended
protection via a systemd timer, verifies recovery readiness, and — behind a deliberate double
gate, in a lab — drives a full bare-metal recover.

This is a **backup product role**, standalone-first — runnable on its own in a playbook — and
also **selected by the `backup_management` dispatcher** when `backup_type: rear`, joining
`restic` and `bareos` as a product-sibling. A site picks **one** backup product. Every backup
product consumes the **same shared `backup_*` variable interface**, so the dispatcher selects
any of them with one identical call that passes only `action`, and every `backup_rear_*` value
flows straight through. The role ships defaults for all of them, so it also runs standalone.

ReaR's OUTPUT-vs-BACKUP split is the design fault line: the two artifacts are modelled as two
separate variable groups and must not be conflated. `OUTPUT_URL` falls back to `BACKUP_URL`
when left unset, so both artifacts can share one storage target.

## Requirements

- Ansible: 2.15+ · Collection: `ansible.builtin` (systemd, package, template)
- `rear` available from the host package repos (EPEL on EL9; installed by the role)
- A storage target reachable from the host for the rescue image and data backup
  (`backup_rear_backup_url`; `backup_rear_output_url` falls back to it)
- Method-matched tooling is installed automatically by the `client`/`baseline` actions
  (ISO: `xorriso`+`syslinux` on EL9/10, `genisoimage` on EL7/8; NETFS: `nfs-utils`;
  `cifs-utils`/`rsync`/`fuse-sshfs`/`borgbackup` per method and URL scheme)

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `backup` | Lifecycle action (see table below). Bare shared var; the dispatcher passes it in. |
| `backup_rear_output_format` | `ISO` | Rescue image format (`OUTPUT`): ISO/USB/PXE/RAWDISK/OBDR/RAMDISK. |
| `backup_rear_output_url` | `""` | Rescue image destination (`OUTPUT_URL`). Empty falls back to the backup URL. |
| `backup_rear_grub_rescue` | `false` | Add a ReaR rescue entry to the local GRUB menu (`GRUB_RESCUE`). |
| `backup_rear_backup_method` | `NETFS` | Data backup method (`BACKUP`): NETFS/RSYNC/BLOCKCLONE + external TSM/NBU/NSR/BAREOS/BORG/DUPLICITY/EXTERNAL. |
| `backup_rear_backup_url` | `file:///var/lib/rear/output` | Data backup target (`BACKUP_URL`): `nfs://`, `cifs://`, `rsync://`, `sshfs://`, `file:///path`, `usb://`, `tape://`, `iso://`. |
| `backup_rear_backup_prog` | `tar` | Archiver (`BACKUP_PROG`): tar or rsync. |
| `backup_rear_exclude_patterns` | `[/tmp/*, /var/tmp/*, /var/crash/*]` | Paths excluded from the data backup (`BACKUP_PROG_EXCLUDE`, appended to ReaR defaults). |
| `backup_rear_keep_old_backup_copy` | `false` | Keep the previous backup alongside the new one (`NETFS_KEEP_OLD_BACKUP_COPY`). |
| `backup_rear_backup_type` | `""` | `""` (full), `incremental`, or `differential` (`BACKUP_TYPE`). |
| `backup_rear_fullbackup_day` | `Sun` | Day a full backup is forced under incremental/differential (`FULLBACKUPDAY`). |
| `backup_rear_tmpdir` | `/var/tmp` | Scratch directory ReaR builds artifacts in (`TMPDIR`). |
| `backup_rear_config_dir` | `/etc/rear` | Directory holding `local.conf`/`site.conf`. |
| `backup_rear_manage_site_conf` | `false` | Also render the fleet-wide `site.conf`. |
| `backup_rear_server_local_dir` | `/var/lib/rear/output` | Local dir ensured for a `file://` target (server action) and searched by verify. |
| `backup_rear_backup_mode` | `mkbackup` | `backup` action sub-mode: `mkbackup` (image+data) / `mkbackuponly` (data) / `mkrescue` (image). |
| `backup_rear_schedule_enabled` | `true` | Manage the systemd timer (`schedule` action). |
| `backup_rear_schedule_oncalendar` | `Mon..Fri 22:00:00` | systemd `OnCalendar` for the timer. |
| `backup_rear_schedule_command` | `/usr/sbin/rear checklayout \|\| /usr/sbin/rear mkrescue` | Command the scheduled service runs. |
| `backup_rear_recover_execute` | `false` | First half of the `restore` double gate. |
| `backup_rear_recover_confirm_irreversible` | `false` | Second, separate confirmation for `restore` (disk repartition + bootloader). |
| `backup_rear_apply_server` / `_client` / `_schedule` / `_verify` | `true` | `baseline` phase toggles. |

### Actions (`action`)

| Action | Effect |
|---|---|
| `server` | Prepare/validate the storage target the rescue+backup URLs point at (ensures a local `file://` dir; delegate real NFS/rsync exports to a storage role). |
| `client` | Install ReaR + method-matched deps, render `/etc/rear/local.conf` (+ optional `site.conf`). |
| `schedule` | Render config, then install+enable the `rear-mkbackup` systemd service + timer. |
| `backup` | Run a ReaR backup — `mkbackup` / `mkbackuponly` / `mkrescue` per `backup_rear_backup_mode` (default). |
| `verify` | Read-only recovery-readiness check: `rear dump` (config resolves) + `rear checklayout` (drift) + artifact-freshness assert. |
| `restore` | **Lab-only, double-gated** — `rear recover`: repartitions disks, reinstalls the bootloader. Irreversible. |
| `baseline` | Orchestrate `server` → `client` → `schedule` → `verify` (never restore) per the `backup_rear_apply_*` toggles. |
| `present` / `absent` | Manage the `rear` package. |

## Use Cases

**Standalone — install a client, configure DR, take a first backup** (set the
`backup_rear_*` interface directly):

```yaml
- hosts: rhel_servers
  roles:
    - role: rear
      vars:
        action: client
        backup_rear_backup_url: "nfs://backup.example.com/export/rear/{{ inventory_hostname }}"
        backup_rear_output_format: ISO

- hosts: rhel_servers
  roles:
    - role: rear
      vars: { action: backup }        # mkbackup — rescue image + data
```

**Standalone — full baseline plus a scheduled timer:**

```yaml
- hosts: rhel_servers
  roles:
    - role: rear
      vars:
        action: baseline
        backup_rear_backup_url: "nfs://backup.example.com/export/rear/{{ inventory_hostname }}"
        backup_rear_schedule_oncalendar: "Mon..Fri 22:00:00"
```

**Lab-only — a real bare-metal recover** (both gates required, throwaway target):

```yaml
- hosts: recovery_target
  roles:
    - role: rear
      vars:
        action: restore
        backup_rear_recover_execute: true
        backup_rear_recover_confirm_irreversible: true
```

**Via the `backup_management` dispatcher** (same play selects any backup product; the
`backup_rear_*` vars flow straight through):

```yaml
- hosts: rhel_servers
  roles:
    - role: backup_management
      vars:
        backup_action: client
        backup_type: rear
        backup_rear_backup_url: "nfs://backup.example.com/export/rear/{{ inventory_hostname }}"
```

## Testing

```bash
cd roles/rear && molecule test               # Tier-1 contract (default)
cd roles/rear && molecule test -s functional # Tier-2 functional (installs ReaR, real artifact)
```

The `default` scenario is a control-host contract converge (`hosts: localhost`,
`gather_facts: false`): it loads defaults via `include_vars`, runs the argument-spec negative
test (bogus action), asserts the standalone default contract (including the `restore` double
gate defaulting closed), and stats that each dispatch task file exists — without installing
ReaR or touching disks. The `functional` scenario installs ReaR on a privileged EL9 container,
renders `/etc/rear` at a `file://` target, resolves the config with `rear dump`, checks the
layout, and produces a real recovery artifact (it attempts a rescue ISO and always produces a
`mkbackuponly` data backup — see the converge comment for the container caveat). `rear recover`
is exercised only in a Tier-3 KVM lab against a throwaway target, never in CI.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-16) |
| functional | almalinux9 | Pass (2026-07-16) — data backup artifact (`backup.tar.gz`) produced; rescue ISO attempted (see Bugfixes) |

### Bugfixes

- None specific to this role at creation. The functional scenario deliberately treats
  `rear mkrescue` (rescue ISO build) as best-effort inside a container — block/bootloader
  introspection is unreliable there — and asserts on the container-friendly `mkbackuponly`
  data-backup artifact, which gives a genuine functional signal. Full rescue-ISO + `rear
  recover` proof is a Tier-3 KVM-lab concern.

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/rear.md`](../../docs/rear.md) — ReaR internals, the OUTPUT/BACKUP split,
  action lifecycle, storage targets, and container caveats.
- Family index: [`docs/backup-management.md`](../../docs/backup-management.md) — the backup
  product family and the shared `backup_*` interface.
- Sibling products: `restic` (snapshot-based), `bareos` (director/daemon enterprise).
- Dispatcher: `backup_management` (`backup_type`).
