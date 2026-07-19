<!-- BEGIN: requirements traceability [pm_ansible] (generated — cmdb_action: test_report) -->
# Requirements traceability — pm_ansible (generated)

Generated from `pm_ansible/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| PMANS-FR-001 (T2) | create/rotate SHALL generate ISM-compliant passwords (length + all four character classes, retry-until-compliant) honouring pm_special_chars via environment passing (never Jinja-interpolated into the generator — the quoting-safety fix), storing vault-encrypted. | molecule:`default` | covered — molecule |
| PMANS-FR-002 (T2) | read/delete/audit SHALL round-trip stored secrets with an append-only audit trail (each create invocation appends — by design, not idempotent). | molecule:`default` | covered — molecule |
| PMANS-FR-003 (T3) | The full lifecycle SHALL run via the dispatcher against lab hosts. | lab:`playbooks/password_management.yml#pm_hosts` | lab-ready / Tier-3 |
<!-- END: requirements traceability [pm_ansible] (generated — cmdb_action: test_report) -->
