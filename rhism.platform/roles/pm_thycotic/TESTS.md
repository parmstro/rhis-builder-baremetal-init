<!-- BEGIN: requirements traceability [pm_thycotic] (generated — cmdb_action: test_report) -->
# Requirements traceability — pm_thycotic (generated)

Generated from `pm_thycotic/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| PMTHY-FR-001 (T1) | Secret lifecycle SHALL drive Delinea/Thycotic Secret Server via the forked delinea.tss collection (REST, no SDK), with TSS-touching tasks isolated in include_tasks files so pm_thycotic_skip_api dry-runs never resolve the collection (BUG-029). | molecule:`default` | covered — molecule |
| PMTHY-FR-002 (T2) | Generated passwords SHALL be ISM-compliant with the real generator's retry-until-compliant guarantee mirrored in the compliance test (BUG-088 — no flaky assertions). | molecule:`default` | covered — molecule |
| PMTHY-FR-003 (T3) | The full lifecycle SHALL run against a real Secret Server instance. | lab:`playbooks/password_management.yml#pm_hosts` | lab-ready / Tier-3 |
<!-- END: requirements traceability [pm_thycotic] (generated — cmdb_action: test_report) -->
