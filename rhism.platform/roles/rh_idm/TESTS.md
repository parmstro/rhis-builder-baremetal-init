<!-- BEGIN: requirements traceability [rh_idm] (generated — cmdb_action: test_report) -->
# Requirements traceability — rh_idm (generated)

Generated from `rh_idm/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| RHIDM-FR-001 (T1) | The role SHALL validate `action` against the shared 19-action family set at entry and fail fast on invalid input. | molecule:`default` | covered — molecule |
| RHIDM-FR-002 (T1) | Deployment actions SHALL be dry-run gated (`idm_server_install`/ `idm_replica_install`/`idm_client_install` default false), including the shared prepare tasks — module-stream enable, packages, firewall (BUG-094). | molecule:`default` | covered — molecule |
| RHIDM-FR-003 (T1) | Server preparation SHALL reuse the `rhel_subscription` role for RHSM registration rather than inlining registration logic (reuse doctrine — same pattern as satellite/gitlab_ee/ocp). | molecule:`default` | covered — molecule |
| RHIDM-FR-004 (T1) | The role SHALL consume the shared family interface unchanged so the `identity_management` dispatcher selects it via `idm_type: rh_idm` with no per-product code. | molecule:`identity_management/default` | covered — molecule |
| RHIDM-FR-005 (T1) | `action: acme` SHALL behave identically to freeipa's (shared task design): ipa-acme-manage server-side, certmonger client `request`, mutations gated by `idm_acme_execute`. | molecule:`default` | covered — molecule |
| RHIDM-FR-006 (T3) | With gates enabled on an entitled RHEL host, `action: server` SHALL deploy a working Red Hat IdM server. | lab:`playbooks/identity_management.yml#freeipa` | lab-ready / Tier-3 |
<!-- END: requirements traceability [rh_idm] (generated — cmdb_action: test_report) -->
