# scm_deploy

SCM deployment role — GitLab CE/EE with runners, backup, and restore.

## Actions

| `scm_action` | Description |
|---|---|
| `install` | Install GitLab packages via official script |
| `configure` | Deploy `gitlab.rb` and run `gitlab-ctl reconfigure` |
| `runners` | Install and register GitLab Runner |
| `backup` | Run `gitlab-rake gitlab:backup:create` |
| `restore` | Stop services, restore backup, restart |
| `baseline` | Install + configure + runners in dependency order |

## Types

| `scm_type` | Description |
|---|---|
| `gitlab_ce` | GitLab Community Edition |
| `gitlab_ee` | GitLab Enterprise Edition (requires RHSM or license key) |

## Requirements

- RHEL/CentOS 8 or 9
- `become: true` — all tasks require privilege escalation
- `scm_install_execute: true` required to install packages (default: false — dry run)
- Minimum 4 GB RAM, 4 vCPU, 10 GB disk recommended
- `ansible.builtin.expect` (pexpect Python library) for `restore` action

## Variables

```yaml
# Required
scm_action: baseline           # install | configure | runners | backup | restore | baseline
scm_type: gitlab_ce            # gitlab_ce | gitlab_ee

# Gate (default false — dry run)
scm_install_execute: false

# Orchestrator toggles (baseline action)
scm_apply_install: true
scm_apply_configure: true
scm_apply_runners: false       # runners require valid token
scm_apply_backup: false

# Core settings
scm_external_url: https://gitlab.example.com
scm_no_log: true

# TLS
scm_tls_enabled: true
scm_letsencrypt_enabled: false
scm_tls_cert: ""               # path to cert on target host
scm_tls_key: ""                # path to key on target host

# External database (optional — uses bundled PostgreSQL by default)
scm_db_external: false
scm_db_host: ""
scm_db_port: 5432
scm_db_name: gitlabhq_production
scm_db_user: gitlab
scm_db_password: ""            # vault-backed

# SMTP / email
scm_smtp_enabled: false
scm_smtp_address: ""
scm_smtp_port: 587
scm_smtp_user_name: ""
scm_smtp_password: ""          # vault-backed
scm_smtp_from: "gitlab@{{ scm_external_url | urlsplit('hostname') }}"

# Backup
scm_backup_path: /var/opt/gitlab/backups
scm_backup_keep_time: 604800   # 7 days in seconds

# Puma tuning
scm_puma_worker_processes: 2
scm_puma_min_threads: 4
scm_puma_max_threads: 4

# Sidekiq
scm_sidekiq_concurrency: 25

# Runners
scm_runner_url: "{{ scm_external_url }}"
scm_runner_token: ""           # vault-backed, no_log: true
scm_runner_name: "{{ inventory_hostname }}-runner"
scm_runner_executor: shell
scm_runner_tags: []

# Restore
scm_restore_backup_file: ""    # filename only (e.g. 1234567890_2024_01_01_17.0.0_gitlab_backup.tar)
scm_rhsm_skip_registration: false  # set true in molecule to skip RHSM check
```

## Example playbooks

```yaml
- name: Deploy GitLab CE
  hosts: gitlab_servers
  vars:
    scm_action: baseline
    scm_type: gitlab_ce
    scm_external_url: https://gitlab.lab.example.com
    scm_install_execute: true
    scm_tls_letsencrypt_enabled: true
    scm_smtp_enabled: true
    scm_smtp_address: mail.example.com
  roles:
    - role: scm_deploy
```

```yaml
- name: Register GitLab Runners
  hosts: gitlab_runners
  vars:
    scm_action: runners
    scm_type: gitlab_ce
    scm_external_url: https://gitlab.lab.example.com
    scm_install_execute: true
    scm_runner_token: "{{ vault_gitlab_runner_token }}"
    scm_runner_executor: docker
    scm_runner_tags:
      - platform
      - molecule
  roles:
    - role: scm_deploy
```

## Molecule scenarios

| Scenario | What it tests |
|---|---|
| `default` | Dispatcher validation + type var loading + negative tests |
| `gitlab` | GitLab CE install dry-run on RHEL9 UBI |

## Tags

- `scm_deploy` — all tasks
- `scm_deploy-install` — install phase
- `scm_deploy-configure` — configuration phase
- `scm_deploy-runners` — runner registration phase
- `scm_deploy-backup` — backup phase

## CI

```bash
bash bin/scm-deploy-ci.sh
```

Phase toggles: `SCM_DO_LINT=false`, `SCM_DO_SECRETS=false`, `SCM_DO_MOLECULE=false`

On macOS (run via Podman Machine):

```bash
podman machine ssh "cd '$PWD' && bash bin/scm-deploy-ci.sh"
```

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9/ubi:latest | All dispatcher + dry-run tests pass |

**Scenario: default** — validates dispatcher routing and variable loading for both GitLab editions without a real GitLab instance:

| Test | What is verified |
|---|---|
| `baseline` (gitlab_ce, no-op) | `scm_type: gitlab_ce` vars loaded; all apply flags false; completes cleanly |
| `baseline` (gitlab_ee, no-op) | `scm_type: gitlab_ee` vars loaded; RHSM skip flag respected; completes cleanly |
| `install` (gitlab_ce, dry-run) | `scm_install_execute: false` skips omnibus installer download; task logic exercised |
| Dispatcher rejects invalid `scm_action` | `bogus_action` raises assertion error (caught in rescue block) |
| Dispatcher rejects invalid `scm_type` | `bogus_type` raises assertion error (caught in rescue block) |

Full GitLab deployment (omnibus install, initial configuration, runner registration) requires a RHEL/Rocky target with network access to packages.gitlab.com and sufficient RAM (≥4 GB).
