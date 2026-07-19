<!-- BEGIN: requirements traceability [backup_management] (generated — cmdb_action: test_report) -->
# Requirements traceability — backup_management (generated)

Generated from `backup_management/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| BACKUP-FR-001 (T1) | The dispatcher SHALL validate backup_type and action, selecting any product (bareos/restic) via one identical parameterised include_role with the shared backup_* family interface (sameness — BUG-040 class namespace mismatches are the failure this guards against). | molecule:`default` | covered — molecule |
| BACKUP-FR-002 (T2) | Every product's verify action SHALL assert backup INTEGRITY, not just completion: checksum verification plus an actual restore-test (restore to scratch, assert data returns) — see docs/backup-integrity.md. | molecule:`restic/functional` | covered — molecule |
<!-- END: requirements traceability [backup_management] (generated — cmdb_action: test_report) -->
