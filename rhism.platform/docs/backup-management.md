# Backup products — family index

High-level overview of the **backup product-role family** selected by the `backup_management`
dispatcher. Each product has its own depth doc (linked below); this page covers only what they
share, so nothing here is duplicated per-role.

## The family

A site uses **exactly one** backup product per protection domain — they are competing
architectures, so each is its own standalone-first role and the family is open (adding e.g.
`borg` is a new role + one `backup_type` value, touching nothing else).

| Role | Architecture | Best for | Depth doc |
|---|---|---|---|
| `restic` | agentless, decentralised encrypted snapshots to any backend | per-host encrypted file backups, cloud object storage | [`docs/restic.md`](restic.md) |
| `bareos` | Director + Storage Daemon + File Daemon with a central catalog | fleet-wide enterprise file backup with scheduling and media management | [`docs/bareos.md`](bareos.md) |
| `rear` | Relax-and-Recover: bootable rescue image + matching data backup | RHEL/Linux **bare-metal disaster recovery** — rebuild a destroyed host onto replacement hardware | [`docs/rear.md`](rear.md) |
| `oadp` | OpenShift API for Data Protection (Velero-based) operator | **OpenShift/Kubernetes application** backup and restore to object storage | [`docs/oadp.md`](oadp.md) |

These are **architecturally very different** and even protect different *things* — restic and
bareos back up files on a running host; `rear` makes a bare machine recoverable from scratch;
`oadp` protects containerised application workloads on a cluster. They deliberately share only
the dispatcher interface, not their internal task structure.

## Shared dispatcher interface

The `backup_management` dispatcher validates `backup_action` + `backup_type`, then selects the
product with one identical call and passes the lifecycle step in via `action`:

```yaml
# backup_management selects any product with the same line:
- ansible.builtin.include_role:
    name: "{{ backup_type }}"      # restic | bareos | rear | oadp
  vars:
    action: "{{ backup_action }}"  # server | client | schedule | verify | restore | baseline
```

The dispatcher exposes `backup_*`-prefixed variables (e.g. `backup_restic_repository`,
`backup_rear_backup_url`, `backup_oadp_namespace`) and the product roles read **those same
names** — so the dispatcher passes only `action` and every `backup_<product>_*` value flows
straight through with no per-product mapping. This is the "sameness" that lets one dispatcher
line select any product. Each product role ships defaults for the shared names, so it also runs
standalone (`roles: [rhism.platform.rear]` / `roles: [rhism.platform.oadp]` / …) with no
dispatcher required. The interface and action `choices` are declared and validated in each role's
`meta/argument_specs.yml` (ansible-core runs the validation at role entry — there is no manual
`assert`).

The dispatcher exposes the six-step common lifecycle (`server`, `client`, `schedule`, `verify`,
`restore`, `baseline`). Individual product roles may support additional actions standalone (e.g.
`rear` and `oadp` each add a `backup` action, and `rear` adds `present`/`absent` package
management) — see each role's depth doc.

## Selecting a product

- **`restic`** — a host needs encrypted, deduplicated file backups to a local, SFTP, or cloud
  object-store repository, with no server to run.
- **`bareos`** — a fleet needs centrally scheduled/catalogued file backup with media management,
  run as a Director/Storage/File-Daemon system.
- **`rear`** — a physical or virtual RHEL/Linux host must be **recoverable onto bare metal** after
  total loss: `rear` pairs a bootable rescue image with a data backup so the machine can be
  rebuilt from scratch. This is disaster recovery, complementary to (not a replacement for) a
  file-backup product.
- **`oadp`** — **OpenShift/Kubernetes application workloads** (namespaced resources + persistent
  volumes) need backup/restore to object storage via the Red Hat-supported, Velero-based
  operator.

Note that `rear` and `oadp` protect fundamentally different layers from `restic`/`bareos`, so a
site may legitimately run `rear` for host DR *and* a file-backup product for data — the "exactly
one per protection domain" rule is about not stacking two competing tools for the *same* job.

## Standalone vs dispatched

- **Standalone** — set the shared vars (`backup_<product>_*`) and call the role directly. Best
  when a playbook targets one product deliberately.
- **Dispatched** — set `backup_type` + `backup_*` vars once and let `backup_management` pick the
  product. Best when the backup product is a site-level choice driven from group_vars.

Per-product internals, action lifecycles, configuration models, and gotchas live in each role's
depth doc above.
