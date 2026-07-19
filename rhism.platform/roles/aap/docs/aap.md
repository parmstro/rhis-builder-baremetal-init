# aap — depth doc

> Scaffolded skeleton for caller review. Relocate/mirror to the orchestration
> repo `docs/aap.md` + the `ansible-base-station` wiki per the platform doc
> convention once reviewed.

Red Hat Ansible Automation Platform (AAP) full-lifecycle **product role** —
install, configure, day-2 — version-aware across AAP 2.4/2.5/2.6/2.7, deploying
via **Red Hat's own installer** (containerized) or the **OpenShift operator**.
Never reimplements the install; renders the installer inputs and invokes it.

## Where it sits

- **AAP vs AWX** — this role is the *supported* Red Hat product; the separate
  `awx` role automates the *OSS* upstream (the `rh_idm` vs `freeipa` parallel).
- **configure is the role's OWN engine** — fully self-contained (owner decision
  2026-07-15): `tasks/config_<section>.yml` for organization, credentials,
  projects, inventories, templates, workflows, schedules. No `include_role` of
  `awx_config` or `awx` — the duplication with the OSS `awx` role's config
  engine is deliberately traded for product independence. The `awx.awx` module
  FQCNs are the controller's API client, not a role dependency; the certified
  `infra.aap_configuration` / gateway collections are the recorded future path
  (open Hub/EDA decision).
- **`aap_config_as_code` is separate** — extract/transform/import version
  migration, not part of install/day-2.
- **entitlement reuses `rhel_subscription`** — gated by `aap_manage_subscription`.

## Version-profile model (`vars/versions/<ver>.yml`)

Each profile declares, for its version:

- `gateway_era` — `false` for 2.4 (pre-gateway), `true` for 2.5+.
- `install_methods` — always `[containerized, openshift]` (no RPM/bundle).
- `controller_api_base` / `ping_path` — 2.4 `/api/v2/`, 2.5+ gateway
  `/api/controller/v2/`.
- `containerized.inventory_groups` — the installer group model. 2.4:
  `automationcontroller/automationhub/automationeda/database`. 2.5+: adds
  `automationgateway`.
- `containerized.installer_*_playbook` — Red Hat's install/backup/restore
  playbook names.
- `openshift.cr_kind` / `cr_api_version` — 2.4 pre-gateway per-component CRs
  (`AutomationController` + `AutomationHub`/`EDA`), 2.5+ the unified
  `AnsibleAutomationPlatform`.

The **2.4 → 2.5 gateway restructure** is the load-bearing cross-version fact
(same boundary `aap_config_as_code` documents).

### TODO — verify against official Red Hat docs before a real run

Several profile fields are grounded in the AAP install guides but flagged
`TODO(verify)` in the version files pending a re-check against the live
docs.redhat.com AAP Installation guides:

- 2.4 tech-preview containerized group names + installer playbook name.
- Containerized installer collection/playbook names (`ansible.containerized_installer.*`)
  and the full `all:vars` required-var set per version.
- OpenShift CR `apiVersion` group/versions and operator subscription channels
  per version.

## Actions

| Action | Behaviour | Gate |
|---|---|---|
| `install` | resolve profile → (opt) `rhel_subscription` → render inventory (containerized) or CR (openshift) → invoke installer | `aap_execute` |
| `configure` | own config-as-code engine — `aap_configure_action` = one section (`config_<section>.yml`) or `baseline` (all enabled sections via `aap_apply_*`) | — |
| `baseline` | `install` then `configure` | `aap_execute` (install leg) |
| `backup` / `restore` | version-aware installer backup/restore or `AAP…Backup/Restore` CR | `aap_execute` |
| `upgrade` | re-render + re-run installer for the target version | `aap_execute` |
| `status` | GET the version-correct controller ping endpoint; assert healthy | read-only |

`tasks/main.yml` resolves the version profile, then dispatches via the dict form
of `include_tasks` (BUG-084). `install` further dispatches on
`aap_install_method` to `containerized_install.yml` / `openshift_install.yml`.

## The config-as-code engine (`tasks/config_*.yml`)

Internalised 2026-07-15 from the pre-absorption `awx_config` engine (frozen
`feature-standalone-first-roles` state of the `awx` repo), with every variable
renamed into the role's own namespace:

| Was (`awx_config`) | Now (`aap`) |
|---|---|
| `awx_host` | `aap_controller_host` |
| `awx_username` | `aap_admin_user` |
| `awx_password` | `aap_admin_password` |
| `awx_validate_certs` | `aap_validate_certs` |
| `awx_request_timeout` | `aap_api_timeout` |
| `awx_action` | `aap_configure_action` |
| `awx_apply_<section>` | `aap_apply_<section>` |
| every content var (`awx_organization`, `awx_teams`, `awx_credential_types`, `awx_credentials`, `awx_scm_*`, `awx_projects`, `awx_inventories`, `awx_inventory_sources`, `awx_execution_environment`, `awx_job_templates`, `awx_workflow_templates`, `awx_schedules`, vault inputs) | same name with the `aap_` prefix |

`tasks/configure.yml` asserts `aap_controller_host`, then dispatches (dict-form
`include_tasks`, BUG-084): a single `config_<section>.yml` when
`aap_configure_action` names a section, or all enabled sections in dependency
order (organization → credentials → projects → inventories → templates →
workflows → schedules) for `baseline`, honouring the `aap_apply_*` toggles.

## The `aap_execute` dry-run gate

When `false` (default), install/backup/restore/upgrade **render** the installer
inventory / operator CR and validate the contract, but do **not** invoke Red
Hat's installer. This is what makes the Tier-1 contract test possible and is the
safe default. Set `true` on an entitled host to run for real.

## Testing tiers

- **Tier 1 (molecule `default`, localhost)** — argument-spec negative tests, all
  four profiles load, containerized + OpenShift renders asserted from disk, gate
  proven, dispatch files present.
- **Tier 3 (`playbooks/aap.yml`, entitled hosts / OpenShift)** — real install,
  configure, backup/restore, status (AAP-FR-004..008 in `REQUIREMENTS.yml`).

## Secrets handling

`aap_admin_password`, `aap_pg_password`, registry credentials and
`aap_manifest_path` are consumed under `no_log`. The rendered installer inventory
carries only **placeholder tokens** for secrets; real values are injected to the
installer at run time from a vault source (TODO: wire before first real run).
