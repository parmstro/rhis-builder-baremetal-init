<!-- BEGIN: requirements traceability [mail_server] (generated — cmdb_action: test_report) -->
# Requirements traceability — mail_server (generated)

Generated from `mail_server/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| MAILDISP-FR-001 (T1) | The dispatcher SHALL validate mail_type (relay/full) and action, selecting either product via one parameterised include_role with the shared mail_* interface; install dry-runs SHALL honour the real shared gate variable mail_execute (BUG-095). | molecule:`default` | covered — molecule |
| MAILDISP-FR-002 (T3) | A dispatched deployment SHALL serve mail on a lab host end-to-end. | lab:`playbooks/mail_server.yml#mail_relay` | lab-ready / Tier-3 |
<!-- END: requirements traceability [mail_server] (generated — cmdb_action: test_report) -->
