<!-- BEGIN: requirements traceability [linux_security] (generated — cmdb_action: test_report) -->
# Requirements traceability — linux_security (generated)

Generated from `linux_security/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| LINSEC-FR-001 (T1) | The orchestrator SHALL compose the six domain roles (packages, hardening, firewall, auditing, users, selinux) solely via gated include_role calls — a linux_security_apply_* toggle set false SHALL run ZERO tasks from that domain (no meta dependencies — BUG-102). | molecule:`default` | covered — molecule |
| LINSEC-FR-002 (T2) | With all gates true on an EL host/container, the orchestrator SHALL apply the full baseline (audit package, sshd_config, audit rules, faillock, SELinux graceful-skip in containers) in one run. | molecule:`default` | covered — molecule |
| LINSEC-FR-003 (T2) | The same play SHALL harden BOTH a real host and a container base: host-runtime domains auto-disable in containers (ansible_virtualization_type detection) so a container base bakes CONFIG hardening only (the ubiN-secure build path). | manual: proven by the 2026-07-12 secure-base builds — see TESTS.md in this repo (SECBASE-* cases); a register entry for the base builds is a known gap | manual / Tier-3 |
<!-- END: requirements traceability [linux_security] (generated — cmdb_action: test_report) -->
