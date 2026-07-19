<!-- BEGIN: requirements traceability [cobbler] (generated — cmdb_action: test_report) -->
# Requirements traceability — cobbler (generated)

Generated from `cobbler/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| COBBLER-FR-001 (T1) | The role SHALL consume the shared provisioning-services interface (bare action + prov_* vars) and pass its contract scenario — argument-spec validation, the standalone default (action=configure), the prov_execute dry-run gate, and the negative bad-action path — without installing Cobbler or running the cobbler CLI. | molecule:`default` | covered — molecule |
| COBBLER-FR-002 (T3) | The role SHALL install cobbler, cobbler-web, and httpd on 'present' and open the dns/dhcp/tftp/http/https firewalld services. | lab:`playbooks/provisioning_services.yml#present` | lab-ready / Tier-3 |
| COBBLER-FR-003 (T3) | The role SHALL render settings.yaml on 'configure' (server, next_server, and manage_dhcp/manage_dns/manage_tftp), ensure the tftpboot directory, and run cobbler sync. | lab:`playbooks/provisioning_services.yml#configure` | lab-ready / Tier-3 |
| COBBLER-FR-004 (T3) | The role SHALL register a distribution on 'add_distro' via `cobbler distro add` (name/kernel/initrd/arch/breed/os_version). | lab:`playbooks/provisioning_services.yml#add_distro` | lab-ready / Tier-3 |
| COBBLER-FR-005 (T3) | The role SHALL register a profile bound to a distro on 'add_profile' (optional kickstart). | lab:`playbooks/provisioning_services.yml#add_profile` | lab-ready / Tier-3 |
| COBBLER-FR-006 (T3) | The role SHALL register a system on 'add_system' via `cobbler system add` (name/profile/mac/ip/hostname). | lab:`playbooks/provisioning_services.yml#add_system` | lab-ready / Tier-3 |
| COBBLER-FR-007 (T3) | The role SHALL drop the named system on 'remove_system' (prov_cobbler_system_name). | lab:`playbooks/provisioning_services.yml#remove_system` | lab-ready / Tier-3 |
| COBBLER-FR-008 (T3) | The role SHALL run `cobbler sync` on 'sync' to render the boot configuration into the managed PXE/DHCP/DNS/TFTP infrastructure. | lab:`playbooks/provisioning_services.yml#sync` | lab-ready / Tier-3 |
| COBBLER-FR-009 (T3) | The role SHALL manage the cobblerd service lifecycle on 'started'/'stopped'/'restarted'. | lab:`playbooks/provisioning_services.yml#present` | lab-ready / Tier-3 |
| COBBLER-FR-010 (T3) | The role SHALL report server state via `cobbler status` on 'status'. | lab:`playbooks/provisioning_services.yml#status` | lab-ready / Tier-3 |
| COBBLER-FR-011 (T3) | The role SHALL remove the Cobbler packages and close the firewalld services on 'absent' — a teardown the provisioning lab does not exercise. | — | **UNCOVERED** |
| COBBLER-FR-012 (T3) | A lab host SHALL PXE-boot a registered system against the deployed Cobbler service (the end-to-end network-install outcome). | lab:`playbooks/provisioning_services.yml#pxe` | lab-ready / Tier-3 |
| COBBLER-FR-013 (T3) | As an administrator, I want to register a whole batch of PXE systems in one call, so that the same bare-host-provisioning outcome RHIS achieves through Satellite is available on a genuinely lightweight PXE-only stack. | molecule:`default`; manual: real bulk registration + PXE boot needs a live Cobbler server — rhism alignment Phase C item 2 (light path), Tier-3 lab request not yet prepared for this specific action (COBBLER-FR-012's existing lab path covers single-system PXE boot; bulk-specific verification is a follow-up, not yet executed) | covered — molecule |
<!-- END: requirements traceability [cobbler] (generated — cmdb_action: test_report) -->
