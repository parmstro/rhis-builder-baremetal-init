<!-- BEGIN: requirements traceability [mail_relay] (generated — cmdb_action: test_report) -->
# Requirements traceability — mail_relay (generated)

Generated from `mail_relay/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| MAILRELAY-FR-001 (T2) | The role SHALL deploy a REAL Postfix relay in CI and relay a message (functional scenario: deliver + assert receipt), consuming the shared mail_* family interface. | molecule:`functional` | covered — molecule |
| MAILRELAY-FR-002 (T2) | Relay restrictions and TLS posture SHALL match the configured variables (no hard-coded environment facts). | molecule:`default` | covered — molecule |
| MAILRELAY-FR-003 (T3) | The relay SHALL serve lab hosts as their smarthost. | lab:`playbooks/mail_server.yml#mail_relay` | lab-ready / Tier-3 |
| MAILRELAY-FR-004 (T2) | The system SHALL accept SMTP from permitted networks and relay via the configured smarthost. | — | **UNCOVERED** |
| MAILRELAY-FR-005 (T2) | The system SHALL reject relay attempts from outside mynetworks. | — | **UNCOVERED** |
| MAILRELAY-FR-006 (T2) | The system SHALL offer STARTTLS inbound. | — | **UNCOVERED** |
| MAILRELAY-FR-007 (T2) | The system SHALL attempt/enforce TLS toward the smarthost per smtp_tls_security_level. | — | **UNCOVERED** |
| MAILRELAY-FR-008 (T3) | The system SHALL authenticate to the smarthost with SASL when configured. | — | **UNCOVERED** |
| MAILRELAY-FR-009 (T2) | The system SHALL apply alias/canonical rewriting. | — | **UNCOVERED** |
| MAILRELAY-FR-010 (T2) | The system SHALL enforce message size limits. | — | **UNCOVERED** |
| MAILRELAY-FR-011 (T2) | The system SHALL queue on smarthost outage and deliver on recovery, with queue visibility. | — | **UNCOVERED** |
| MAILRELAY-FR-012 (T2) | The system SHALL expose queue management operations (flush/purge role actions). | — | **UNCOVERED** |
| MAILRELAY-FR-013 (T3) | The system SHALL serve authenticated submission on :587 (role capability gap today). | — | **UNCOVERED** |
| MAILRELAY-FR-014 (T3) | The system SHALL support milter/content-filter hooks (DKIM wave item). | — | **UNCOVERED** |
<!-- END: requirements traceability [mail_relay] (generated — cmdb_action: test_report) -->
