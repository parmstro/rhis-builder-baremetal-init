<!-- BEGIN: requirements traceability [mail_full] (generated — cmdb_action: test_report) -->
# Requirements traceability — mail_full (generated)

Generated from `mail_full/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| MAILFULL-FR-001 (T1) | The role SHALL deploy the full mail stack (Postfix + Dovecot + DKIM — one-line KeyTable records preserved) consuming the shared mail_* interface, dry-run gated by mail_execute. | molecule:`default` | covered — molecule |
| MAILFULL-FR-002 (T3) | A full deployment SHALL send and receive mail on a lab host, DKIM signing verified. | lab:`playbooks/mail_server.yml#mail_relay` | lab-ready / Tier-3 |
<!-- END: requirements traceability [mail_full] (generated — cmdb_action: test_report) -->
