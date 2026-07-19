<!-- BEGIN: requirements traceability [satellite] (generated — cmdb_action: test_report) -->
# Requirements traceability — satellite (generated)

Generated from `satellite/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| SATELLITE-FR-001 (T1) | The role SHALL consume the shared content-management interface (bare action + content_* vars) and pass its contract scenario — argument-spec validation, standalone default (action=status), a dispatch task file for every declared action, and the negative (bad-action) path — without a Red Hat subscription or a live Satellite server. | molecule:`default` | covered — molecule |
| SATELLITE-FR-002 (T1) | The 'install' action SHALL honour the content_install_execute dry-run gate (false prints the satellite-installer command instead of running it). | molecule:`default` | covered — molecule |
| SATELLITE-FR-003 (T3) | With content_install_execute enabled, the role SHALL register the host with RHSM (content_rhsm_org_id/content_rhsm_activation_key), install Satellite via satellite-installer, and upload the subscription manifest (content_rhsm_manifest_path) — genuinely uncoverable by CI (needs a Red Hat subscription + entitlement + manifest). | — | **UNCOVERED** |
| SATELLITE-FR-004 (T3) | The 'cdn_repos' action SHALL enable the configured Red Hat CDN repository sets (Satellite-only, via theforeman.foreman.repository_set) — genuinely uncoverable by CI (needs RHSM entitlement). | — | **UNCOVERED** |
| SATELLITE-FR-005 (T3) | The role SHALL manage the satellite package lifecycle (present/absent) and service lifecycle (started/stopped/restarted). | lab:`playbooks/content_management.yml#install` | lab-ready / Tier-3 |
| SATELLITE-FR-006 (T3) | The 'configure' action SHALL manage the organization, location, lifecycle environments, and global settings via the theforeman.foreman collection. | lab:`playbooks/content_management.yml#configure` | lab-ready / Tier-3 |
| SATELLITE-FR-007 (T3) | The 'repos' action SHALL create the configured custom products and their repositories. | lab:`playbooks/content_management.yml#repos` | lab-ready / Tier-3 |
| SATELLITE-FR-008 (T3) | The 'sync' action SHALL create sync plans, assign products, and optionally trigger an immediate sync (content_sync_now). | lab:`playbooks/content_management.yml#sync` | lab-ready / Tier-3 |
| SATELLITE-FR-009 (T3) | The 'content_views' action SHALL create content views, publish a version, and promote it through the configured lifecycle environments. | lab:`playbooks/content_management.yml#content_views` | lab-ready / Tier-3 |
| SATELLITE-FR-010 (T3) | The 'activation_keys' action SHALL create host collections and activation keys bound to a content view and lifecycle environment. | lab:`playbooks/content_management.yml#activation_keys` | lab-ready / Tier-3 |
| SATELLITE-FR-011 (T3) | The role SHALL register smart proxies ('smart_proxy') and compute resources ('compute_resource') via the theforeman.foreman collection. | lab:`playbooks/content_management.yml#smart_proxy` | lab-ready / Tier-3 |
| SATELLITE-FR-012 (T3) | The 'status' action SHALL report Satellite service and API health. | lab:`playbooks/content_management.yml#status` | lab-ready / Tier-3 |
| SATELLITE-FR-013 (T3) | As an administrator, I want to create bare hosts and trigger their PXE build through the same content-management connection I already use for everything else, so that a new host goes from "does not exist" to "installing" in one role call. | molecule:`default`; manual: real host-create + PXE-build completion needs a live Satellite + compute resource/hypervisor — rhism alignment Phase C item 2, Tier-3 lab request queued (external test lab), not yet executed. Waiting for kickstart completion is deliberately NOT automated by this role — see roles/satellite/docs (or the depth doc once authored) | covered — molecule |
<!-- END: requirements traceability [satellite] (generated — cmdb_action: test_report) -->
