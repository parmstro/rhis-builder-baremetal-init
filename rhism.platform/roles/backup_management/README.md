# backup_management

[![ansible-lint](https://img.shields.io/badge/ansible--lint-passing-brightgreen)](https://ansible-lint.readthedocs.io/)

Multi-backend backup management role supporting **restic** (client-only, cloud-native
encryption, cron-scheduled) and **Bareos** (centralized enterprise backup with
Director / Storage Daemon / File Daemon architecture).

## Actions

| Action | Description |
|--------|-------------|
| `server` | Install and configure Bareos Director + Storage Daemon (bareos type only) |
| `client` | Install and configure backup client (restic scripts or Bareos File Daemon) |
| `schedule` | Configure backup schedule (restic: cron; bareos: Director schedule objects) |
| `restore` | Restore from a named snapshot or Bareos job |
| `verify` | Verify repository integrity and list recent snapshots/jobs |
| `baseline` | Orchestrator — runs actions conditionally via `backup_apply_*` toggles |

## Types

| Type | Description |
|------|-------------|
| `restic` | Client-only; no server daemon; native repo encryption; supports local, S3, SFTP, B2, rclone backends |
| `bareos` | Full director + storage + file daemon architecture; TLS transport; PostgreSQL catalog |

## Requirements

- RHEL / CentOS / AlmaLinux / Rocky 8 or 9
- `become: true` (privilege escalation required)
- Collections: `community.general`, `ansible.posix`

## Key Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `backup_action` | `baseline` | Action to perform |
| `backup_type` | `restic` | Backend type: `restic` or `bareos` |
| `backup_install_execute` | `false` | Set `true` to perform actual installs (dry-run gate) |
| `backup_restic_repository` | `""` | Restic repository URL (local path, s3:, sftp:, b2:, etc.) |
| `backup_restic_password` | `""` | Restic repository encryption password (vault-backed) |
| `backup_restic_paths` | `[/etc, /home, /root, /var/log]` | Directories to back up |
| `backup_restic_cron_enabled` | `true` | Enable cron job for scheduled restic backups |
| `backup_restic_cron_hour` | `"2"` | Hour for restic cron job |
| `backup_bareos_director_host` | `{{ ansible_fqdn }}` | Bareos Director FQDN |
| `backup_bareos_director_password` | `""` | Director console password (vault-backed) |
| `backup_bareos_storage_password` | `""` | Storage Daemon password (vault-backed) |
| `backup_bareos_file_daemon_password` | `""` | File Daemon password (vault-backed) |
| `backup_apply_server` | `false` | Baseline: run server action |
| `backup_apply_client` | `false` | Baseline: run client action |
| `backup_apply_schedule` | `false` | Baseline: run schedule action |
| `backup_apply_verify` | `false` | Baseline: run verify action |

## Example Playbooks

### restic client with S3 backend

```yaml
- name: Configure restic backup client
  hosts: app_servers
  become: true
  roles:
    - role: backup_management
      vars:
        backup_action: client
        backup_type: restic
        backup_install_execute: true
        backup_restic_repository: "s3:s3.amazonaws.com/mybucket/{{ inventory_hostname }}"
        backup_restic_password: "{{ vault_restic_password }}"
        backup_restic_env:
          AWS_ACCESS_KEY_ID: "{{ vault_aws_key_id }}"
          AWS_SECRET_ACCESS_KEY: "{{ vault_aws_secret }}"
```

### Bareos server + client baseline

```yaml
- name: Configure Bareos backup infrastructure
  hosts: backup_director
  become: true
  roles:
    - role: backup_management
      vars:
        backup_action: baseline
        backup_type: bareos
        backup_install_execute: true
        backup_apply_server: true
        backup_apply_client: true
        backup_bareos_director_password: "{{ vault_bareos_dir_password }}"
        backup_bareos_storage_password: "{{ vault_bareos_sd_password }}"
        backup_bareos_file_daemon_password: "{{ vault_bareos_fd_password }}"
        backup_bareos_pools:
          - name: Default
            pool_type: Backup
            recycle: yes
            autoprune: yes
            volume_retention: "365 days"
```

## Molecule Test Scenarios

| Scenario | Description |
|----------|-------------|
| `default` | Dispatcher validation, type var loading, and dry-run installs (no real backend) |
| `restic` | restic client install and repository initialization (requires restic binary) |

## CI

```bash
# macOS (must run inside Podman Machine VM):
podman machine ssh "cd '$PWD' && bash bin/backup-management-ci.sh"

# Linux (direct):
bash bin/backup-management-ci.sh

# Lint only (no Podman Machine needed):
BACKUP_DO_MOLECULE=false bash bin/backup-management-ci.sh
```

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9/ubi:latest | All dispatcher + dry-run tests pass |

**Scenario: default** — validates dispatcher validation and variable loading without a real backup server:

| Test | What is verified |
|---|---|
| `baseline` (restic, no-op) | `backup_type: restic` variables loaded; all apply flags false; role completes |
| `baseline` (bareos, no-op) | `backup_type: bareos` variables loaded; all apply flags false; role completes |
| `client` (restic, dry-run) | `backup_install_execute: false` skips actual restic install; task logic exercised |
| Dispatcher rejects invalid `backup_action` | `bogus_action` raises assertion error (caught in rescue block) |
| Dispatcher rejects invalid `backup_type` | `bogus_type` raises assertion error (caught in rescue block) |

Full server install (Bareos director, Storage daemon, File daemon; restic repository init) requires a supported RHEL/Rocky target with network access to package repos.
