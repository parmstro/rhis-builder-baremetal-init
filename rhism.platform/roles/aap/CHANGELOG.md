# Changelog

All notable changes to this role are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- **Config-as-code engine internalised — the role is now fully self-contained**
  (owner decision 2026-07-15). The `configure` action no longer
  `include_role`s `awx_config` (and never `awx`): the seven config sections
  (organization, credentials, projects, inventories, templates, workflows,
  schedules) now live in this role as `tasks/config_<section>.yml`, dispatched
  by `tasks/configure.yml` (single section via `aap_configure_action`, or
  `baseline` for all enabled sections honouring the new `aap_apply_*`
  toggles). The code duplication with the OSS `awx` role's config engine is
  explicitly traded for product independence.
- Variable map applied at internalisation (`awx_*` → `aap_*`):
  `awx_host`→`aap_controller_host`, `awx_username`→`aap_admin_user` (new,
  default `admin`), `awx_password`→`aap_admin_password`,
  `awx_validate_certs`→`aap_validate_certs`,
  `awx_request_timeout`→`aap_api_timeout`, `awx_action`→`aap_configure_action`
  (now with explicit choices), `awx_apply_*`→`aap_apply_*`, and all content
  vars (`awx_organization`, `awx_teams`, `awx_credential_types`,
  `awx_credentials` + vault inputs, `awx_scm_url_base`/`awx_scm_branch`/
  `awx_scm_credential`, `awx_projects`, `awx_inventories`,
  `awx_inventory_sources`, `awx_execution_environment`, `awx_job_templates`,
  `awx_workflow_templates`, `awx_schedules`) → the same names under `aap_*`.
  The hardcoded project-sync `timeout: 120` was promoted to
  `aap_project_sync_timeout`.
- The `awx.awx` module FQCNs are retained as the controller **API client**
  (not a role dependency); the certified `infra.aap_configuration` / gateway
  collections are the recorded future path (open Hub/EDA decision).
- Molecule contract scenario extended: negative test for a bogus
  `aap_configure_action`, stat of the seven `config_*.yml` engine files, and a
  defaults-contract assertion that the `aap_*` config variables resolve
  self-sufficiently.

## [1.0.0] - 2026-07-14

### Added
- Initial release. Red Hat Ansible Automation Platform full-lifecycle role,
  product role, standalone-first (doctrine-standard `action` variable —
  dispatcher-ready). Distinct from the OSS `awx` role (supported-vs-OSS) and
  from `aap_config_as_code` (separate migration role).
- Version-aware across AAP 2.4/2.5/2.6/2.7 via `vars/versions/<ver>.yml`
  profiles (installer group model, API base paths, OpenShift CR kind/apiVersion;
  2.4 pre-gateway vs 2.5+ gateway era).
- Two install methods, `aap_install_method`: `containerized` (Red Hat's
  podman-based containerized installer) and `openshift` (AAP Operator +
  `AnsibleAutomationPlatform` CR). The RPM/bundle `setup.sh` path is
  deliberately not modelled (RPM install is being obsoleted).
- Actions: `install` (version + method aware, renders the installer
  inventory / operator CR from role vars and invokes Red Hat's own installer),
  `configure` (reuses the `awx_config` role — no config logic copied),
  `baseline` (install → configure), `backup`, `restore`, `upgrade` (day-2),
  `status` (read-only controller ping health check).
- `aap_execute` dry-run gate (default false): install/backup/restore/upgrade
  render + validate the contract without invoking the real installer — enables
  the Tier-1 contract molecule scenario.
- Reuse: `rhel_subscription` for RHSM entitlement (gated by
  `aap_manage_subscription`); `awx_config` for configuration-as-code.
- Tier 1 contract molecule scenario (`default`, localhost): argument-spec
  negative test, all four version profiles load, both containerized inventory
  and OpenShift CR render correctly, the `aap_execute: false` gate leaves the
  installer un-invoked, and all action dispatch files are present. Real install/
  configure/backup/status are Tier 3 (entitled multi-node hosts / OpenShift —
  `playbooks/aap.yml`).
