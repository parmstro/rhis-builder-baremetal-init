<!-- BEGIN: requirements traceability [restic] (generated — cmdb_action: test_report) -->
# Requirements traceability — restic (generated)

Generated from `restic/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| RESTIC-FR-001 (T1) | The role SHALL consume the shared backup_restic_* family interface and run standalone or via the dispatcher. | molecule:`default`; molecule:`backup_management/default` | covered — molecule |
| RESTIC-FR-002 (T2) | backup/verify/restore SHALL work against a real repository: verify includes checksum verification (restic check --read-data-subset) and a restore-test that restores a snapshot to scratch and asserts the data returns (2026-07-11 backup-integrity work). | molecule:`functional` | covered — molecule |
<!-- END: requirements traceability [restic] (generated — cmdb_action: test_report) -->
