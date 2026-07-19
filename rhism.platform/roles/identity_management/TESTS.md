<!-- BEGIN: requirements traceability [identity_management] (generated — cmdb_action: test_report) -->
# Requirements traceability — identity_management (generated)

Generated from `identity_management/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| IDM-FR-001 (T1) | The dispatcher SHALL validate `idm_type` (freeipa \| rh_idm \| ad_integration) and `idm_action`, failing fast with a clear message on invalid combinations (negative tests are part of the scenario). | molecule:`default` | covered — molecule |
| IDM-FR-002 (T1) | The dispatcher SHALL select any product with ONE identical parameterised include_role using the shared family interface — never per-product task code, never tasks_from, action passed via vars (sameness doctrine). | molecule:`default`; molecule:`freeipa` | covered — molecule |
| IDM-FR-003 (T1) | Type-specific settings SHALL load dynamically from vars/<idm_type>.yml at run time; adding a product means a new role plus one type-map entry, with no sibling changes. | molecule:`default` | covered — molecule |
| IDM-FR-004 (T1) | `idm_action: enroll` with `idm_type: ad_integration` SHALL drive AD enrolment (realmd/adcli path) fully behind `idm_ad_enroll_execute` (BUG-094). | molecule:`default` | covered — molecule |
| IDM-FR-005 (T3) | Dispatch into a real product deployment (freeipa server on a live host) SHALL work end-to-end via the dispatcher, not only standalone. | lab:`playbooks/identity_management.yml#freeipa` | lab-ready / Tier-3 |
<!-- END: requirements traceability [identity_management] (generated — cmdb_action: test_report) -->
