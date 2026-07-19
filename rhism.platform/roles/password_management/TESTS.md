<!-- BEGIN: requirements traceability [password_management] (generated — cmdb_action: test_report) -->
# Requirements traceability — password_management (generated)

Generated from `password_management/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| PMDISP-FR-001 (T1) | The dispatcher SHALL validate pm_type (ansible/vault/thycotic) and action, selecting any product via one identical parameterised include_role with the shared pm_* family interface. | molecule:`default` | covered — molecule |
| PMDISP-FR-002 (T3) | Dispatched secret lifecycle SHALL run against a real backing store end-to-end on lab hosts. | lab:`playbooks/password_management.yml#pm_hosts` | lab-ready / Tier-3 |
<!-- END: requirements traceability [password_management] (generated — cmdb_action: test_report) -->
