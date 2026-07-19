# builder (rhism.platform.builder)

rhism estate builder orchestrator — reads an `rhism.platform.wizard` deployment manifest and drives all component roles (security, Tang/NBDE, identity, provisioning, secrets, content, mail, SCM, backup, container platform, monitoring) in dependency order.

This is rhism's own independent estate builder (owner decision
2026-07-16: rhism carries its own builder rather than depending on another
collection's builder at runtime). This role's dispatch
order and internal logic are proven mechanics, with the
components the estate profile actually uses (`linux_security`,
`identity_management`, `provisioning_services`, `content_management`,
`satellite`, `tang`, and `linux_security`'s own 6 sub-roles) vendored
directly into this collection rather than reached via
`rhism.platform.*` — see "Self-containment" below.

## Description

`rhism.platform.builder` reads the YAML manifest written by
`rhism.platform.wizard` and calls each enabled component role in the
correct dependency order, ensuring services are available before dependent
services start. All child role calls are dry-run by default
(`pb_deploy_execute: false`).

## Actions

| Action | Description |
|--------|-------------|
| `plan` | Load manifest, validate, display a human-readable deployment plan — no changes |
| `deploy` | Call all enabled component roles in dependency order |
| `verify` | Run health checks on deployed services (systemctl, kubectl, gitlab-ctl) |
| `teardown` | Stop all services in reverse order; packages/data are NOT removed |

## Deployment Order

When `pb_action: deploy`, roles are called in this sequence:

1. `linux_security` — baseline hardening (must be first); vendored — its
   own 6 sub-roles (`linux_packages`, `linux_hardening`, `firewall`,
   `linux_auditing`, `linux_users`, `linux_selinux`) fire unconditionally
1b. **Tang/NBDE key escrow** — `components.tang.enabled`: dispatches
   directly to the vendored `tang` role by plain name (same-collection
   resolution — not a product-family member of any dispatcher)
1c. **KVM hypervisor platform** — `components.hypervisor.enabled` &
   type `kvm`: the compute substrate, stood up early. Dispatches directly
   to the vendored `kvm_platform` product role (no hypervisor dispatcher
   exists — `hypervisor_factory` is a VM-migration orchestrator, not a
   platform selector), running its `install` (packages + libvirtd) then
   `configure` (default pool + network) actions. `vmware`/`proxmox` are
   NOT wired (product roles not vendored) — a manifest choosing them would
   need that role vendored and a branch added (honest, documented boundary)
2. `identity_management` — IdM (other services join the domain); vendored,
   dispatches internally to `rh_idm`; optionally establishes AD trust
   (`freeipa.ansible_freeipa.ipatrust`) when
   `components.identity.ad_trust.enabled`
3. `provisioning_services` — DNS/DHCP/PXE for node provisioning; vendored,
   dispatches internally to `satellite_proxy`
3b. **Bare-host provisioning** — `components.provisioning.hosts`:
   dispatches directly to `rhism.platform.cobbler` (`action:
   add_systems`, light/no-Satellite PXE path — NOT vendored, since the
   estate profile always selects the Satellite path) or the vendored
   `satellite` role (`action: host`, heavy/Satellite-integrated path),
   selected by the SAME `components.provisioning.type` used by Step 3.
   Empty `hosts` list = no-op.
3.5. `password_management` — secrets backend (ansible/vault/thycotic) —
   NOT vendored (the estate profile disables secrets), so later steps can
   pull credentials rather than embed them
4. `content_management` — Satellite/Foreman package repos; vendored,
   dispatches internally to `satellite` (the same vendored copy Step 3b
   uses)
5. `mail_server` — NOT vendored (estate profile disables mail)
6. `scm_deploy` — NOT vendored (estate profile disables SCM)
7. `backup_management` — NOT vendored (estate profile disables backup)
8. `container_platform` — NOT vendored (estate profile disables it)
9. `monitoring_stack` — NOT vendored (estate profile disables monitoring)
10. **Ansible Automation Platform (AAP)** — `components.automation.enabled`
   & type `aap`: the automation control plane, stood up last (after the
   infrastructure it manages). Dispatches directly to the vendored `aap`
   product role (self-contained per owner decision 2026-07-15 — its own
   config-as-code engine, reuses the vendored `rhel_subscription` for
   entitlement). Runs `install` (renders the containerized installer
   inventory / OpenShift CR, invokes Red Hat's own installer when executed);
   a follow-up `configure` (config-as-code) runs only when
   `pb_deploy_execute` is true AND `pb_aap_controller_host` is set (a real
   controller must be up). `aap_config_as_code` (controller-to-controller
   migration/ETL) is deliberately NOT vendored — not needed to stand up the
   estate.

Teardown runs in strict reverse order.

## Self-containment

This collection vendors copies of the role directories the estate
profile actually exercises (`linux_security` + its 6 sub-roles, `tang`,
`kvm_platform`, `identity_management` + `rh_idm`, `provisioning_services` +
`satellite_proxy`, `satellite`, `content_management`, `aap` +
`rhel_subscription`) so a fresh install of just `rhism.platform` deploys the
full estate profile with no `rhism.platform` dependency. Components the estate
profile *disables* (secrets, mail, SCM, backup, container platform, monitoring)
and siblings it doesn't select (`cobbler`, `freeipa`, `foreman`,
`vmware_platform`, `proxmox_platform`) are deliberately **not** vendored — a
manifest that enables one of those still reaches out to `rhism.platform.*`
(an honest, documented boundary, not silently broken). See
`docs/rhism-builder.md` for the full reasoning.

## Manifest Format

The manifest is written by `rhism.platform.wizard` (default path: `/opt/rhism/manifests/rhism-deployment-manifest.yml`):

```yaml
profile: estate   # or: custom
components:
  identity:
    enabled: true
    type: rh_idm         # this collection vendors rh_idm; freeipa/ad_integration
                          # are not vendored and stay rhism.platform.*-only
    ad_trust:            # optional, off-by-default — cross-realm
      enabled: false     # Kerberos trust FROM this rh_idm server TO an
      domain: ""         # existing AD forest (freeipa.ansible_freeipa.ipatrust).
      admin: Administrator
      range_type: ipa-ad-trust
                          # The trust admin password is NEVER stored in the manifest —
                          # set pb_idm_ad_trust_password via -e/vault at deploy time.
  provisioning:
    enabled: true
    type: satellite_proxy  # this collection vendors satellite_proxy; dnsmasq/
                            # cobbler/foreman_proxy stay rhism.platform.*-only
    hosts: []            # bare hosts to provision — empty = no-op.
                          # Shape depends on type: cobbler wants {name, profile, mac,
                          # ip, hostname} per entry; satellite_proxy wants {fqdn
                          # (required), hostgroup, compute_resource, ...} — see
                          # roles/cobbler and roles/satellite meta/argument_specs.yml.
  secrets:
    enabled: false       # not vendored into this collection — rhism.platform.*
    type: ansible         # only, if enabled
    target: rhism-platform-admin
  content:
    enabled: true
    type: satellite      # this collection vendors satellite; foreman does not
  mail:
    enabled: false        # not vendored — rhism.platform.* only, if enabled
    type: relay
  scm:
    enabled: false        # not vendored — rhism.platform.* only, if enabled
    type: gitlab_ce
  backup:
    enabled: false        # not vendored — rhism.platform.* only, if enabled
    type: restic
  container_platform:
    enabled: false        # not vendored — rhism.platform.* only, if enabled
    type: k3s
  security:
    enabled: true
    type: default
  monitoring:
    enabled: false        # not vendored — rhism.platform.* only, if enabled
    type: default
  tang:
    enabled: true        # NBDE/disk-encryption key escrow — vendored
    type: default
network: {}
sizing: {}
credentials: {}
licensing: {}
```

## Requirements

- Standalone: no external `ANSIBLE_ROLES_PATH` dependency for the estate
  profile's own 14 vendored components; components outside that scope
  (secrets/mail/scm/backup/container_platform/monitoring/cobbler-path
  provisioning) need `rhism.platform` installed if a manifest enables
  them
- RHEL/CentOS 8–9
- Privilege escalation (`become: true`)

## Key Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `pb_action` | `plan` | Action: `plan`, `deploy`, `verify`, `teardown` |
| `pb_manifest_path` | `/opt/rhism/manifests/rhism-deployment-manifest.yml` | Path to the rhism.platform.wizard manifest — a deliberately distinct default path/filename so two manifests never overwrite each other on a shared control host |
| `pb_deploy_execute` | `false` | Dry-run gate — set `true` to apply changes |
| `pb_enable_<component>` | `""` | Override manifest enable flag (empty = use manifest) |
| `pb_<component>_type` | `""` | Override manifest type (empty = use manifest) |
| `pb_pm_type` | `""` | Secrets backend override: `ansible` \| `vault` \| `thycotic` (empty = use manifest) |
| `pb_pm_action` | `create` | `password_management` action for the Step 3.5 dispatch |
| `pb_idm_apply_server` | `true` | Pass to identity_management baseline |
| `pb_idm_apply_trust` | `""` | AD trust override: empty = use manifest `components.identity.ad_trust.enabled`; true/false = override |
| `pb_idm_ad_trust_password` | `""` | AD trust admin password — override/vault only, never manifest content |
| `pb_content_apply_install` | `true` | Pass to content_management baseline |
| `pb_cp_apply_install` | `true` | Pass to container_platform baseline |
| `pb_sizing` | `s` | Capacity-planning tier for the orchestrator itself — see below |

Secrets (Step 3.5) honours `pb_deploy_execute` via the shared `pm_execute` family variable — a
dry-run validates the manifest's secrets configuration and dispatch routing without writing
credentials or calling a real Vault/TSS backend.

### Capacity planning (t-shirt sizing)

Additive figures, OS baseline excluded (1 vCPU / 2 GB / 20 GB, RHEL 9 — see
`docs/capacity-planning.md`). Named `pb_sizing` rather than `builder_sizing`
to stay consistent with every other variable in this role's own `pb_`
prefix — a deliberate deviation from the doc's literal `<role>_sizing`
wording, not an oversight.

| Tier (`pb_sizing`) | CPU | RAM | Disk |
|---|---|---|---|
| `s` (default, only tier — invariant workload) | 1 | 512 MB | 1 GB |

The estate's own real capacity rating (identity/content servers,
hypervisor hosts, Tang hosts) is selected via `rhism.platform.wizard`'s
`wizard_estate_sizing_tier` — see that role's own README.

## Example Playbooks

### Show deployment plan (no changes)

```yaml
- hosts: localhost
  connection: local
  roles:
    - role: rhism.platform.builder
      vars:
        pb_action: plan
        pb_manifest_path: /opt/rhism/manifests/rhism-deployment-manifest.yml
```

### Deploy dry-run (validate without applying)

```yaml
- hosts: all
  roles:
    - role: rhism.platform.builder
      vars:
        pb_action: deploy
        pb_deploy_execute: false
```

### Deploy live

```yaml
- hosts: all
  roles:
    - role: rhism.platform.builder
      vars:
        pb_action: deploy
        pb_deploy_execute: true
        pb_idm_apply_server: true
        pb_cp_apply_install: true
```

Or use the provided collection playbook:

```bash
ansible-playbook rhism.platform.deploy \
  -e pb_action=deploy \
  -e pb_deploy_execute=true
```

## Molecule Tests

```bash
# Run inside the EE (this collection has no dedicated CI wrapper script yet
# — matches the base-EE testing pattern documented in the orchestration
# repo's CLAUDE.md for roles without one):
podman machine ssh "cd '$PWD' && source bin/ci-lib.sh && \
  ANSIBLE_ROLES_PATH=/workspace/roles run_in_ee ansible_galaxy_ee:latest \
  bash -c 'cd /workspace/collections/rhism/platform/roles/builder && molecule test -s default'"
```

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9/ubi:latest | PASS (2026-07-16, in-collection) — all plan + dry-run + dispatch tests pass |
| supported | ubi9/ubi:latest | PASS (2026-07-16) — full flagship manifest, every enabled step dispatched |
| supported_rhsm | (manual only) | Not run in CI — requires real RHSM credentials + a pre-provisioned RHEL9 VM |

**Scenario: default** — validates manifest loading, plan display, and deploy orchestration routing without triggering any real installs:

| Test | What is verified |
|---|---|
| `plan` action | Test manifest loaded from `molecule/default/files/test-manifest.yml`; plan summary displayed without errors |
| `deploy` (dry-run) | `pb_deploy_execute: false` + all component apply flags false; orchestrator routes manifest to sub-roles without executing installations |
| Dispatcher rejects invalid `pb_action` | `bogus_action` raises assertion error (caught in rescue block) |
| Bare-host provisioning — cobbler | `molecule/default/files/test-manifest-provisioning.yml` (`provisioning.type: cobbler`, one host entry) dispatches to `rhism.platform.cobbler action: add_systems` (not vendored) — `prov_execute: false` (from `pb_deploy_execute`) makes cobbler's own dispatch gate skip the real `cobbler system add` — proves real routing without a live cobbler server |
| Bare-host provisioning — satellite skip | Same fixture with `pb_provisioning_type: satellite_proxy` override; the vendored `satellite`'s `host` action has no execute-gate of its own, so builder gates the whole step on `pb_deploy_execute\|bool` — converge only succeeds because the step is skipped (a real `theforeman.foreman.host` call against no live Satellite would fail the play) |

**Scenario: supported** — same shape as `default` but against the flagship `supported-manifest.yml` fixture (every component enabled, Red Hat stack types) — proves dispatch order and dry-run safety hold even when every step is turned on, exercising both vendored (`rhism.platform.*`) and non-vendored (`rhism.platform.*`) dispatch paths in one run.

Full estate deployment (IdM, Satellite, Tang, security hardening) requires target hosts, RHSM credentials, and network access to CDN and package repos.

Bugs found building this role (see `roles/cmdb/vars/platform_bugs.yml`,
**BUG-044**), still relevant here:
- Scenario `hosts:`/`connection:` didn't match production usage (`hosts: localhost, connection: local`) — `pb_manifest_path` is `playbook_dir`-relative and must resolve on the controller.
- `identity_management` asserts `idm_domain` unconditionally at role entry, even in a full dry-run.
- `monitoring_stack` (step 9) has no apply-gate — it dispatches for real whenever its manifest component is enabled, regardless of `pb_deploy_execute`. The `supported` scenario overrides `pb_enable_monitoring` to `false` for this reason (the manifest fixture's own `enabled: true` is still asserted by `verify.yml`).
- **BUG-194 (fixed 2026-07-19, lab-runner)**: `linux_security` (step 1) and `content_management` (step 4) previously ran real actions on a dry-run — `linux_security` had no apply-gate at all (real root-requiring hardening fired regardless of `pb_deploy_execute`), and content's `content_apply_configure/repos/sync` defaulted `true` (satellite `configure.yml` hit the live Foreman API). Surfaced on the live AWX day-1 DAG (the security convergence node and content node failed under `pb_deploy_execute=false`). Now both gate their apply toggles on `pb_deploy_execute | bool` (mirroring `mail_server`/`kvm_platform`-configure); a dry-run skips them cleanly and the full 8-node day-1 workflow converges green. Re-verified live (workflow_job 116) — see `roles/cmdb/vars/platform_tests.yml` `TEST-RHISM-ESTATE-CAC-DAY1`.
- `roles/satellite`'s `host` action carries no `content_install_execute`-style execute gate of its own (unlike `install.yml`) — `content_hosts` non-empty is the only guard, so a real `theforeman.foreman.host` API call would fire the moment the manifest declares bare hosts, dry-run or not. Builder's Step 3b closes that gap at the orchestrator layer with an explicit `pb_deploy_execute | bool` condition rather than modifying the product role.

**`automation`/`hypervisor` manifest fields (closed 2026-07-16)**: the estate
profile's manifest declares `components.hypervisor` (type=kvm) and
`components.automation` (type=aap). These were previously wizard-only fields
(TUI page, validation, sizing) with NO corresponding `deploy.yml` dispatch
step — so an estate manifest that turned them on silently deployed neither.
Now wired: the KVM hypervisor stands up early (Step 1c — `kvm_platform`
install + configure, gated on `type=kvm`) and AAP as the capstone (Step 10 —
`aap` install, plus an optional config-as-code step gated on a known
controller URL). Both product roles (and `aap`'s `rhel_subscription`
dependency) are vendored into this collection. `vmware`/`proxmox` hypervisors
remain unwired by design (their product roles are not vendored — a matching
branch would be added alongside vendoring them).
