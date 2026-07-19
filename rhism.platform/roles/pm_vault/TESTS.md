<!-- BEGIN: requirements traceability [pm_vault] (generated — cmdb_action: test_report) -->
# Requirements traceability — pm_vault (generated)

Generated from `pm_vault/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| PMVAULT-FR-001 (T2) | server SHALL deploy and initialise a Vault server (init/unseal via the vault CLI where no module exists, KV v2 + AppRole enablement), with service handlers gated on pm_vault_manage_service (BUG-026). | molecule:`server` | covered — molecule |
| PMVAULT-FR-002 (T2) | Secret lifecycle SHALL use the community.hashi_vault v7 KV2 modules (vault_kv2_write/get/delete, engine_mount_point — BUG-027) against a live Vault, generating ISM-compliant secrets; a REAL hvac-backed call SHALL work in the EE (BUG-087). | molecule:`default` | covered — molecule |
| PMVAULT-FR-003 (T3) | The full lifecycle SHALL run via the dispatcher against lab hosts. | lab:`playbooks/password_management.yml#pm_hosts` | lab-ready / Tier-3 |
<!-- END: requirements traceability [pm_vault] (generated — cmdb_action: test_report) -->
