# aap

## Description

`rhism.platform.aap` is the **full-lifecycle** role for **Red Hat Ansible Automation
Platform (AAP)** — install, configure, and day-2. It is a **product role**
(standalone-first; a dispatcher may also select it).

It deploys AAP using **Red Hat's own installer** — the role never reimplements
the install. It renders the installer inputs (the **containerized** installer
inventory or the **OpenShift** operator custom resource) from role variables and
invokes Red Hat's installer. It is **version-aware** across AAP **2.4, 2.5, 2.6,
2.7**: a per-version profile (`vars/versions/<ver>.yml`) carries that version's
installer group model, API base paths, and OpenShift CR kind/apiVersion. The key
cross-version fact is the **2.4 → 2.5 platform-gateway restructure** (2.5
introduces the unified gateway, the `automationgateway` installer group, and the
unified `AnsibleAutomationPlatform` custom resource).

**AAP vs AWX.** This role is the **supported** Red Hat product; the separate
`awx` role automates the **OSS** upstream. This is the same
supported-vs-community split as `rh_idm` vs `freeipa`. Choose exactly one.

**Relationship to the config roles.** `aap` is **fully self-contained** (owner
decision 2026-07-15): its `configure` action is the role's **own**
config-as-code engine (`tasks/config_*.yml` — organization, credentials,
projects, inventories, templates, workflows, schedules). It does **not**
`include_role` any other role for configuration — the code duplication with
the OSS `awx` role's config engine was explicitly traded for product
independence. The `awx.awx` module FQCNs are the **API client** for the
controller, not a role dependency; the certified `infra.aap_configuration` /
gateway collections are the recorded future path (open Hub/EDA decision).
`awx` remains the OSS counterpart role. `aap_config_as_code` is unchanged — a
**separate** role for extract/transform/import migration between AAP versions;
it is not part of this role.

> The RPM/bundle `setup.sh` install path is **deliberately not modelled** — RPM
> install is being obsoleted. `aap_install_method` is exactly `containerized` or
> `openshift`.

## Requirements

- **Ansible**: core 2.15+ (role argument-spec validation).
- **Collections**: `awx.awx` (configure — the role's own config engine's API
  client), `kubernetes.core` (OpenShift method),
  `ansible.containerized_installer` (containerized method, real run).
  `awx.awx` lives in the `ansible_galaxy_platform_ee` EE layer.
- **RHSM entitlement**: a real install needs entitled RHEL hosts and
  `registry.redhat.io` credentials. Entitlement is handled by reusing the
  `rhel_subscription` role (gated by `aap_manage_subscription`).
- **Target hosts (containerized)**: RHEL hosts for the controller / hub / EDA /
  gateway (2.5+) / database groups. **Target (openshift)**: an OpenShift cluster
  reachable by `kubernetes.core`.

## Role Variables

See `defaults/main.yml` and `meta/argument_specs.yml` for the full typed
interface. Key variables:

| Variable | Default | Purpose |
|---|---|---|
| `action` | `install` | `install` \| `configure` \| `baseline` \| `backup` \| `restore` \| `upgrade` \| `status` |
| `aap_version` | `2.5` | `2.4` \| `2.5` \| `2.6` \| `2.7` — selects the version profile |
| `aap_install_method` | `containerized` | `containerized` \| `openshift` |
| `aap_execute` | `false` | Dry-run gate: false renders + validates only, does NOT run the real installer |
| `aap_manage_subscription` | `true` | Register hosts with RHSM (via `rhel_subscription`) before install |
| `aap_controller_hosts` / `aap_hub_hosts` / `aap_eda_hosts` / `aap_gateway_hosts` | `[]` | Installer group membership (gateway = 2.5+) |
| `aap_database_host` | `""` | Installer `database` group host |
| `aap_admin_password` | `""` | AAP admin password (no_log; placeholder-tokenised in the rendered inventory) |
| `aap_pg_username` / `aap_pg_password` / `aap_pg_port` | `admin` / `""` / `5432` | PostgreSQL admin credentials (password no_log) |
| `aap_registry_host` / `aap_registry_username` / `aap_registry_password` | `registry.redhat.io` / `""` / `""` | Image-pull registry (creds no_log) |
| `aap_openshift_namespace` / `aap_operator_channel` / `aap_openshift_cr_name` | `aap` / `""` / `aap` | OpenShift operator + CR settings |
| `aap_controller_host` | `""` | Controller URL for `configure` / `status` |
| `aap_admin_user` | `admin` | Controller admin username for the API |
| `aap_configure_action` | `baseline` | Config section (`organization` \| `credentials` \| `projects` \| `inventories` \| `templates` \| `workflows` \| `schedules`) or `baseline` (all enabled sections) |
| `aap_apply_*` | `true` ×7 | Baseline toggles, one per config section |
| `aap_organization` / `aap_teams` | `rhism` / 3 teams | Organization + teams content |
| `aap_credential_types` / `aap_credentials` | CMDB + ITSM types / 4 creds | Credential content (secrets from vault: `aap_scm_ssh_key`, `aap_linux_ssh_key`, `aap_windows_password`, `aap_vault_password`) |
| `aap_projects` / `aap_inventories` / `aap_inventory_sources` | platform repos / dev+prod+test | SCM projects + inventories content |
| `aap_job_templates` / `aap_workflow_templates` / `aap_schedules` | platform catalogue | Job/workflow templates + schedules content |
| `aap_work_dir` | `{{ playbook_dir }}/../output/aap` | Where the installer inventory / CR renders (repo-confined) |

Sensitive variables (`aap_admin_password`, `aap_pg_password`, the registry
credentials, `aap_manifest_path`) are consumed under `no_log`, and secrets are
written to the rendered installer inventory only as **placeholder tokens**
(`__ADMIN_PASSWORD__`, …) — never in clear on disk.

> **T-shirt sizing:** controller/hub/gateway/EDA/database node RAM/CPU/disk
> minimums are per-host `group_vars` concerns under the platform's additive
> t-shirt-sizing model — they are not baked into this role.

## Use Cases / Example Playbooks

### Standalone — render + install a 2.5 controller (containerized)

```yaml
- hosts: localhost
  gather_facts: false
  roles:
    - role: aap
      vars:
        action: install
        aap_version: "2.5"
        aap_install_method: containerized
        aap_execute: true                      # false = render + validate only
        aap_gateway_hosts: [gw.example.com]
        aap_controller_hosts: [ctrl.example.com]
        aap_hub_hosts: [hub.example.com]
        aap_eda_hosts: [eda.example.com]
        aap_database_host: db.example.com
        aap_admin_password: "{{ vault_aap_admin }}"
        aap_registry_username: "{{ vault_rh_registry_user }}"
        aap_registry_password: "{{ vault_rh_registry_pass }}"
```

### Baseline — install then configure end-to-end

```yaml
- hosts: localhost
  roles:
    - role: aap
      vars:
        action: baseline
        aap_version: "2.6"
        aap_execute: true
        aap_controller_hosts: [ctrl.example.com]
        aap_database_host: db.example.com
        aap_admin_password: "{{ vault_aap_admin }}"
        aap_controller_host: "https://ctrl.example.com"
        aap_configure_action: baseline          # the role's own config engine
```

### A 2.4 (pre-gateway) install

```yaml
- hosts: localhost
  roles:
    - role: aap
      vars:
        action: install
        aap_version: "2.4"                      # no automationgateway group
        aap_install_method: containerized
        aap_execute: true
        aap_controller_hosts: [ctrl.example.com]
        aap_hub_hosts: [hub.example.com]
        aap_database_host: db.example.com
        aap_admin_password: "{{ vault_aap_admin }}"
```

### Via a dispatcher

A dispatcher selects this role by passing the action as a var (never
`tasks_from:`):

```yaml
- name: Deploy the supported automation platform
  ansible.builtin.include_role:
    name: aap
  vars:
    action: baseline
```

## Testing

Molecule scenario `default` is a **Tier 1 contract** test on the control host
(localhost) — AAP is a heavy, licensed, multi-node appliance (and the OpenShift
path needs a cluster), so it cannot run in CI (same constraint as `satellite`).
The scenario:

- argument-spec **negative tests** (bogus `action`, bogus `aap_version`, bogus
  `aap_configure_action`) via block/rescue;
- asserts the **config-as-code contract**: the seven `tasks/config_<section>.yml`
  engine files exist and the `aap_*` config defaults (connection, toggles,
  organization/teams/credential/project/template/workflow/schedule content)
  resolve self-sufficiently;
- asserts all four version profiles (2.4/2.5/2.6/2.7) load and expose their
  install methods (`containerized`/`openshift`, no RPM) and group model (2.4
  pre-gateway, 2.5+ with `automationgateway`);
- **renders** a 2.5 containerized installer inventory, a 2.4 (pre-gateway) one,
  and a 2.5 OpenShift CR for a sample host set, then asserts the rendered content
  from disk (groups, hosts, admin-password placeholders, unified CR kind) — a
  genuine functional assertion of the render logic;
- proves the `aap_execute: false` dry-run gate leaves Red Hat's real installer
  un-invoked;
- stats a dispatch file for every action.

**Real** install/configure/backup/restore/upgrade/status are **Tier 3** —
entitled multi-node hosts / an OpenShift cluster (`playbooks/aap.yml`), tracked
in `REQUIREMENTS.yml` (AAP-FR-004..008).

Run locally (inside the EE):

```bash
podman machine ssh "cd '$PWD' && bash bin/<aap>-ci.sh"   # once a wrapper is wired
```

## Support / License

- **License**: MIT.
- Maintained by the platform team.

## Related Information

- Depth doc: [`docs/aap.md`](docs/aap.md) — internals, version-profile model,
  install-method dispatch, workflows. (Scaffolded role-local; the caller should
  relocate/mirror it to the orchestration repo `docs/aap.md` + the wiki per the
  platform doc convention.)
- Reused roles: `rhel_subscription` (entitlement) — the only role reuse;
  configuration is self-contained.
- Related: `aap_config_as_code` (separate AAP version-migration role), `awx`
  (the OSS counterpart, which carries its own config engine).
- Red Hat AAP installation guides (containerized + OpenShift) ground the
  version profiles.

## Molecule test results

| Scenario | Tier | Result |
|---|---|---|
| `default` | 1 (contract) | Pass (2026-07-15, `ansible_galaxy_ee:latest` — incl. self-contained config-engine contract: bogus `aap_configure_action` rejected, 7 `config_*.yml` present, `aap_*` defaults resolve, configure.yml delegation-free) |

### Bugfixes

_None yet._
