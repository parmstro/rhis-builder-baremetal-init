# gitlab_ee

## Description

Installs and manages [GitLab Enterprise Edition](https://about.gitlab.com/install/) (the
omnibus package) on Enterprise Linux 9, covering the full lifecycle: RHSM registration,
install/remove, `gitlab.rb` configuration, CI runner registration, backup and restore,
package upgrade, service state, and status.

This is a **product role** — one of the two SCM editions (`gitlab_ce`, `gitlab_ee`). It is
**standalone-first** (runnable on its own in a playbook) and is also **selected by the
`scm_deploy` dispatcher** when `scm_type: gitlab_ee`. Both editions consume the **same
variable interface** (`action`, `scm_*`), so the dispatcher selects either with one
identical call and no per-edition code. CE and EE remain **separate roles** because
Enterprise is a distinct, licensed install target — EE additionally registers with a Red
Hat subscription (RHSM) and installs the `gitlab-ee` package.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld), `community.general` (RHSM)
- Target: an EL9 host with `dnf` and internet access to `packages.gitlab.com`
- A Red Hat subscription (`scm_rhsm_org_id` + `scm_rhsm_activation_key`) and a GitLab EE
  licence when running a real EE install with RHSM required
- Privilege escalation (`become`) for package, RHSM, firewall, and `gitlab-ctl` operations

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `present` | `present`/`absent` · `configure`/`reconfigure` · `runners` · `backup`/`restore` · `upgrade` · `status` · `started`/`stopped`/`restarted`. Shared with `gitlab_ce`; the dispatcher passes it in. |
| `scm_external_url` | `http://localhost` | External URL GitLab serves on (`EXTERNAL_URL` at install; default runner URL). |
| `scm_config_template` | `""` | Path to a `gitlab.rb` template. Empty runs a bare reconfigure. |
| `scm_runners` | `[]` | Runner definitions to register (`name`, `token`, optional `url`/`executor`/`docker_image`/`tags`/`run_untagged`). |
| `scm_backup_path` | `/var/opt/gitlab/backups` | Directory GitLab writes backups to. |
| `scm_backup_skip` | `""` | Comma-separated backup components to `SKIP`. |
| `scm_restore_backup_id` | `""` | Backup ID to restore from (required for `restore`). |
| `scm_open_http` / `scm_open_https` / `scm_open_ssh` | `true` | Firewall services to open. |
| `scm_purge_config` | `false` | On `absent`, also remove `/etc/gitlab`. |
| `scm_upgrade_execute` | `false` | Existing dry-run gate for `upgrade` — `false` blocks a real package upgrade; set `true` to upgrade. Reused as the molecule dry-run gate. |
| `scm_rhsm_skip_registration` | `false` | Skip RHSM registration during `present` even when required. |
| `scm_rhsm_org_id` | `""` | RHSM organisation ID (EE-only). |
| `scm_rhsm_activation_key` | `""` | RHSM activation key (EE-only). |

## Use Cases

**Standalone — install GitLab EE with RHSM:**

```yaml
- hosts: scm_servers
  roles:
    - role: gitlab_ee
      vars:
        action: present
        scm_external_url: https://gitlab.example.com
        scm_rhsm_org_id: "{{ vault_rhsm_org_id }}"
        scm_rhsm_activation_key: "{{ vault_rhsm_activation_key }}"
```

**Standalone — take a backup, then upgrade:**

```yaml
- hosts: scm_servers
  roles:
    - role: gitlab_ee
      vars: { action: backup }
    - role: gitlab_ee
      vars: { action: upgrade, scm_upgrade_execute: true }
```

**Standalone — remove GitLab EE (and purge config):**

```yaml
- hosts: scm_servers
  roles:
    - role: gitlab_ee
      vars: { action: absent, scm_purge_config: true }
```

**Via the `scm_deploy` dispatcher** (same interface selects either edition):

```yaml
- hosts: scm_servers
  roles:
    - role: scm_deploy
      vars:
        scm_action: install
        scm_type: gitlab_ee
        scm_external_url: https://gitlab.example.com
```

## Testing

```bash
cd roles/gitlab_ee && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own on `ubi9` and validates the argument-spec
interface, action dispatch, the shared variable contract, the negative (bad-action) path,
and the `scm_upgrade_execute` dry-run gate — without installing a real GitLab or contacting
RHSM. A live install is exercised in the full-stack test lab (`inventories/test/`), not in
molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/gitlab_ee.md`](../../docs/gitlab_ee.md) — internals, action workflows,
  RHSM handling, permutations, and gotchas.
- Family index: [`docs/scm-deploy.md`](../../docs/scm-deploy.md) — the SCM edition family and
  the shared `scm_*` interface.
- Sibling edition: `gitlab_ce`.
- Dispatcher: `scm_deploy` (`scm_type`).
