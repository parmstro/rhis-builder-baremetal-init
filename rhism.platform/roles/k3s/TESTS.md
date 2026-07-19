<!-- BEGIN: requirements traceability [k3s] (generated — cmdb_action: test_report) -->
# Requirements traceability — k3s (generated)

Generated from `k3s/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| K3S-FR-001 (T1) | The role SHALL consume the shared container_platform family interface (cp_*) with absolute binary paths surviving sudo secure_path (BUG-041) and pass its contract scenario without a cluster. | molecule:`default` | covered — molecule |
| K3S-FR-002 (T2) | A REAL single-node cluster SHALL deploy and reach Ready in CI under rootless podman with zero host exposure (KubeletInUserNamespace, private cgroupns, cpuset delegation — the k3s-rootless recipe), and the service SHALL be active. | molecule:`functional` | covered — molecule |
<!-- END: requirements traceability [k3s] (generated — cmdb_action: test_report) -->
