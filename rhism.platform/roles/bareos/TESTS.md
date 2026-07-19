<!-- BEGIN: requirements traceability [bareos] (generated — cmdb_action: test_report) -->
# Requirements traceability — bareos (generated)

Generated from `bareos/REQUIREMENTS.yml` joined against the platform
test register (`roles/cmdb/vars/platform_tests.yml`) and the molecule
scenarios on disk, by `cmdb_action: test_report` with
`cmdb_tests_report_style: requirements` — do not edit this block by hand;
re-run `playbooks/test_xray_reports.yml` to refresh. A requirement with no
live verifier renders **UNCOVERED** by design: gaps are visible, not silent.

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| BAREOS-FR-001 (T1) | The role SHALL consume the shared backup_bareos_* family interface (BUG-040 fix) and run standalone or via the backup_management dispatcher. | molecule:`default`; molecule:`backup_management/default` | covered — molecule |
| BAREOS-FR-002 (T1) | verify SHALL default to a REAL integrity check — VolumeToCatalog (attribute+checksum comparison against the catalog), never the no-op InitCatalog (the pre-2026-07-11 defect). | molecule:`default` | covered — molecule |
| BAREOS-FR-003 (T3) | A real Bareos deployment SHALL back up and restore data end-to-end (director+storage+client). | lab:`playbooks/backup_management.yml#bareos_directors` | lab-ready / Tier-3 |
| BAREOS-FR-004 (T2) | The role SHALL deploy a complete stack — Director, Storage Daemon, File Daemon, PostgreSQL catalog. | — | **UNCOVERED** |
| BAREOS-FR-005 (T2) | The system SHALL run Full, Incremental and Differential backup levels. | — | **UNCOVERED** |
| BAREOS-FR-006 (T2) | The system SHALL synthesise a VirtualFull without re-reading the client. | — | **UNCOVERED** |
| BAREOS-FR-007 (T2) | The system SHALL restore a full job to the original path. | — | **UNCOVERED** |
| BAREOS-FR-008 (T2) | The system SHALL restore selected files to a redirected location (where=). | — | **UNCOVERED** |
| BAREOS-FR-009 (T2) | The system SHALL verify DiskToCatalog in addition to the VolumeToCatalog default. | — | **UNCOVERED** |
| BAREOS-FR-010 (T2) | The system SHALL run jobs automatically from Schedule resources. | — | **UNCOVERED** |
| BAREOS-FR-011 (T2) | The system SHALL manage volume lifecycle — pools, retention, recycling, prune/purge. | — | **UNCOVERED** |
| BAREOS-FR-012 (T2) | The system SHALL operate the Always Incremental scheme with Consolidate jobs. | — | **UNCOVERED** |
| BAREOS-FR-013 (T2) | The system SHALL copy jobs to a second pool (Copy job type). | — | **UNCOVERED** |
| BAREOS-FR-014 (T2) | The system SHALL migrate jobs between pools (Migration job type). | — | **UNCOVERED** |
| BAREOS-FR-015 (T2) | The system SHALL encrypt daemon-to-daemon transport with TLS. | — | **UNCOVERED** |
| BAREOS-FR-016 (T2) | The system SHALL encrypt backup data client-side (PKI) and verify signatures on restore. | — | **UNCOVERED** |
| BAREOS-FR-017 (T2) | The system SHALL compress (LZ4/GZIP) and checksum (SHA) file data per FileSet options. | — | **UNCOVERED** |
| BAREOS-FR-018 (T2) | The system SHALL detect moved/deleted files via Accurate mode. | — | **UNCOVERED** |
| BAREOS-FR-019 (T2) | The system SHALL restrict named consoles via Profile/ACL resources. | — | **UNCOVERED** |
| BAREOS-FR-020 (T2) | The system SHALL write an audit log of console commands. | — | **UNCOVERED** |
| BAREOS-FR-021 (T2) | The system SHALL serve the WebUI for operating and restore browsing. | — | **UNCOVERED** |
| BAREOS-FR-022 (T2) | The system SHALL back up arbitrary command streams via the bpipe plugin. | — | **UNCOVERED** |
| BAREOS-FR-023 (T2) | The system SHALL back up a live PostgreSQL database via the postgresql plugin. | — | **UNCOVERED** |
| BAREOS-FR-024 (T2) | The system SHALL protect its own catalog via the BackupCatalog job. | — | **UNCOVERED** |
| BAREOS-FR-025 (T3) | The system SHALL back up NDMP filers (expected FAIL in container scope — no NDMP filer). | — | **UNCOVERED** |
| BAREOS-FR-026 (T3) | The system SHALL drive tape drives and autochangers (expected FAIL — no tape hardware in container scope). | — | **UNCOVERED** |
| BAREOS-FR-027 (T3) | The system SHALL store volumes on S3-compatible object storage (droplet/dplcompat; MinIO-sibling follow-up candidate). | — | **UNCOVERED** |
| BAREOS-FR-028 (T2) | The system SHALL limit client bandwidth and spool data before despooling to volumes. | — | **UNCOVERED** |
| BAREOS-FR-029 (T2) | The system SHALL support passive clients / client-initiated connections. | — | **UNCOVERED** |
| BAREOS-FR-030 (T2) | The system SHALL check and repair catalog integrity with bareos-dbcheck. | — | **UNCOVERED** |

## Non-functional requirements

| Req ID | Requirement | Verified by | Status |
|---|---|---|---|
| BAREOS-NFR-001 | Built FROM all three ubi{8,9,10}-secure bases; per-base differences recorded in FPS.md. | — | **UNCOVERED** |
| BAREOS-NFR-002 | Official bareos.org repo, GPG-verified, version pinned; base digest-pinned. | — | **UNCOVERED** |
| BAREOS-NFR-003 | Image size <= 600 MB per image. | — | **UNCOVERED** |
| BAREOS-NFR-004 | Director answers bconsole status <= 30 s from container start. | — | **UNCOVERED** |
| BAREOS-NFR-005 | Idle RSS <= 512 MB (S t-shirt; runtime tuning, never baked). | — | **UNCOVERED** |
| BAREOS-NFR-006 | no-new-privileges, SELinux confined, minimal ports, bareos user where supported. | — | **UNCOVERED** |
| BAREOS-NFR-007 | No secrets/keys baked into any image — per-instance at runtime. | — | **UNCOVERED** |
| BAREOS-NFR-008 | 0 fixable Critical CVEs; fixable Highs treated via the hardening loop. | — | **UNCOVERED** |
| BAREOS-NFR-009 | CycloneDX SBOM per image in sbom/. | — | **UNCOVERED** |
| BAREOS-NFR-010 | Reproducible via Dockerfile built through roles/podman. | — | **UNCOVERED** |
| BAREOS-NFR-011 | Role double-converge clean during the live-role-test build. | — | **UNCOVERED** |
| BAREOS-NFR-012 | 1 GB reference dataset restored in-container <= 5 min. | — | **UNCOVERED** |
| BAREOS-NFR-013 | Registered in platform_images.yml + periodic hardening loop. | — | **UNCOVERED** |
<!-- END: requirements traceability [bareos] (generated — cmdb_action: test_report) -->
