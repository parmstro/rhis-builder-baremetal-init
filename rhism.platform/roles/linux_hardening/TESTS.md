<!-- BEGIN: requirements traceability [linux_hardening] (generated — cmdb_action: test_report) -->
# Requirements traceability — linux_hardening (generated)

Generated from `linux_hardening/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| LINHARD-FR-001 (T2) | sysctl hardening SHALL support live apply AND config-only mode (linux_hardening_sysctl_apply false → lineinfile to linux_hardening_sysctl_file, no sysctl-binary dependency — BUG-020/103) so minimal/container images harden without procps-ng. | molecule:`default` | covered — molecule |
| LINHARD-FR-002 (T2) | sshd hardening SHALL deploy the CIS config (PermitRootLogin no, PasswordAuthentication no, etc.) with skippable validation and skippable server install (ssh_validate/ssh_install_server — BUG-104): image builds bake config only, never host keys. | molecule:`default` | covered — molecule |
| LINHARD-FR-003 (T2) | Kernel-module blacklisting SHALL support live unload AND config-only mode (modules_apply false → CIS-style /etc/modprobe.d files, no kmod dependency — BUG-105). | molecule:`default` | covered — molecule |
| LINHARD-FR-004 (T2) | PAM password quality SHALL render pwquality.conf with the configured minlen/minclass. | molecule:`default` | covered — molecule |
| LINHARD-FR-005 (T2) | The config-only baseline baked into a container image SHALL hold at runtime: hardened sshd_config accepts key-only auth on derived images (proven over real SSH by the lab). | register:`TEST-SSH-LAB-TRANSPORT` | verified — register pass |
<!-- END: requirements traceability [linux_hardening] (generated — cmdb_action: test_report) -->
