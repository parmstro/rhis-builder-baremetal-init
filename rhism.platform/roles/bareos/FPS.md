# Bareos — Function and Performance Specification (FPS)

Image-factory pilot artifact (owner brief 2026-07-13; plan of record:
orchestration `docs/image-factory-plan.md`). Requirements below derive from
the **product's documented capability**, not from what this role currently
codes — rows that fail or cannot pass in container scope are recorded
honestly, never dropped.

**Provenance** (reputable-sources rule, researched 2026-07-13):
- Capability catalogue: https://docs.bareos.org/ (official documentation —
  Tasks & Concepts, Security, Plugins, NDMP, Storage Backends chapters).
- Release line: Bareos **25.x** current stable (verified via
  https://github.com/bareos/bareos/releases; exact package version is pinned
  at build time from the repo metadata — see P1).
- Packages: https://download.bareos.org/current/ community repository —
  serves **EL_8, EL_9 and EL_10** (RHEL-and-derivatives), GPG-signed
  (`RPM-GPG-KEY` + `bareos.repo` per EL directory). (Corrects the plan's
  expectation that EL10 might be absent.)
- **Version pin (P1, 2026-07-13)**: `25.1.0~pre17.1c4281d8e-72` — the
  community repo publishes **rolling builds of the stable branch** (tagged
  release RPMs are subscription-only on download.bareos.com), so the exact
  NVR is the pin: installs use the full version string, and the tested NVR
  is recorded here and in the Dockerfile.
- **Architecture finding (P1)**: EL_9 and EL_10 ship **aarch64 + x86_64**;
  **EL_8 ships x86_64 only** — no aarch64 packages exist upstream, so the
  ubi8-secure variant is **not natively buildable on this arm64 lab**
  (recorded per-base outcome, not a defect of ours; an emulated-x86_64
  build is a possible follow-up, out of pilot scope).
- Catalog backend: PostgreSQL only (MySQL support removed upstream).
- **Catalog deployment decision (P1, revised P2)**: sibling PostgreSQL
  container, not in-image. **P2 finding**: UBI repos carry the postgresql
  CLIENT only — `postgresql-server` does not exist there (samba-dc class),
  so building a catalog image on ubiN-secure is impossible. Per the decision
  tree the catalog is the CONSUMED verified RH image
  `registry.redhat.io/rhel9/postgresql-16@sha256:b152a7ffc2883f6659d1359e9dc6280b10ecca4ebcdbf8c397b13019d543e02b`
  (pulled 2026-07-13, entitled; a docker.io exception is NOT justified while
  an RH equivalent exists). The bareos image carries only the psql client +
  bareos-database-postgresql.
- **GPG identity (P2)**: repo metadata + packages signed by "Bareos
  experimental Signing Key <signing@bareos.com>", fingerprint
  `8283 4CF0 02D8 9BA5 5C1E D0AA 42DA 24A6 DFEF 9127`; repo file mirrors
  upstream's own `EL_N/bareos.repo` verbatim (baseurl at the EL_N level,
  `repo_gpgcheck=1`).
- **Pinning lesson (P2)**: a full RPM pin is `name-version-release.DISTTAG`
  — the disttag varies per base (`.el9`/`.el10`), so the Dockerfile appends
  `.el${EL_VERSION}` to the shared NVR build-arg.
- **macOS/Podman-Machine auth lesson (P2)**: `podman login registry.redhat.io`
  lives with the HOST client — entitled pulls must run via the host `podman`,
  not `podman machine ssh podman pull` (VM-local CLI sees no host auth).

**Scope**: the role's service delivered as a secure container set built on
`ubi{8,9,10}-secure` (director + storage daemon + file daemon; PostgreSQL
catalog as a sibling container or in-image — decided at P1 and recorded
here). Out of scope for the container pilot: physical tape hardware, NDMP
filers, Windows clients — their FRs remain listed and render as honest
fails/not-in-scope.

## Functional requirements

FR-001..003 pre-exist in `REQUIREMENTS.yml` (family interface, real verify
default, lab e2e). FR-004+ are capability-derived for this pilot. **Rows
below are capability statements only** — tool-agnostic where a real
alternative product exists, no test-procedure or scope-verdict language
(owner rule 2026-07-16: FPS/REQUIREMENTS content is what the product does
and why an operator needs it, never how or whether it was tested that run).
Verification method and scope caveats live in `verified_by`-style register
entries, not in this table. Statuses live in the generated traceability
block in `TESTS.md`; execution evidence lives in
`roles/cmdb/vars/platform_tests.yml` (register `TEST-BAREOS-FPS-P4` and
successors) — that register, not this file, is the single home for pass/
fail/evidence.

| ID | The system SHALL… | Source (docs.bareos.org) | Tier |
|---|---|---|---|
| BAREOS-FR-004 | deploy a complete stack — Director, Storage Daemon, File Daemon, PostgreSQL catalog — via this role | Introduction/Installation | 2 |
| BAREOS-FR-005 | run Full, Incremental and Differential backup levels | Tasks: Jobs & Schedules | 2 |
| BAREOS-FR-006 | synthesise a VirtualFull from existing Full+Incr without re-reading the client | Tasks: VirtualFull | 2 |
| BAREOS-FR-007 | restore a full job to the original path | Tasks: Restore | 2 |
| BAREOS-FR-008 | restore selected files to a redirected location | Tasks: Restore | 2 |
| BAREOS-FR-009 | verify a job's data on disk against the catalog, in addition to volume-to-catalog verification (FR-002) | Configuration: Verify Job | 2 |
| BAREOS-FR-010 | run jobs automatically on a schedule | Tasks: Jobs & Schedules | 2 |
| BAREOS-FR-011 | manage volume lifecycle — pools, retention, recycling, prune/purge | Tasks: Volume Management | 2 |
| BAREOS-FR-012 | operate an always-incremental backup scheme with periodic consolidation | Tasks: Always Incremental | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-013 | copy completed jobs to a second pool for redundancy | Tasks: Migration and Copy | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-014 | migrate jobs between pools | Tasks: Migration and Copy | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-015 | encrypt daemon-to-daemon transport | Security: Transport Encryption | 2 |
| BAREOS-FR-016 | encrypt backup data client-side and verify signatures on restore | Security: Data Encryption | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-017 | compress and checksum file data per fileset policy | Configuration: FileSet | 2 |
| BAREOS-FR-018 | detect moved/deleted files without a full re-scan (accurate mode) | Tasks: Accurate Mode | 2 |
| BAREOS-FR-019 | restrict named consoles to a defined set of permissions | Configuration: Console/Profile | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-020 | write an audit log of console commands | Configuration: Director (auditing) | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-021 | serve a web console for operating and restore browsing | Introduction: WebUI | 3 (build-arg variant candidate) |
| BAREOS-FR-022 | back up arbitrary command-stream output via a plugin | Plugins: bpipe | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-023 | back up a live PostgreSQL database via a database-aware plugin | Plugins: PostgreSQL | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-024 | protect its own catalog via a self-backup job | Tasks: Catalog Maintenance | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-025 | back up NDMP-attached filers | NDMP Backups | 3 (no NDMP filer in this platform's lab scope) |
| BAREOS-FR-026 | drive tape drives and autochangers | Tasks: Autochanger Support | 3 (no tape hardware in this platform's lab scope) |
| BAREOS-FR-027 | store volumes on S3-compatible object storage | Storage Backends | 3 (MinIO-sibling follow-up candidate) |
| BAREOS-FR-028 | limit client bandwidth and spool data before despooling to volumes | Tasks: Data Spooling / setbandwidth | 2 |
| BAREOS-FR-029 | support passive/client-initiated connections for NAT-friendly clients | Configuration: Client | 2 (capability gap — see TESTS.md) |
| BAREOS-FR-030 | check and repair catalog integrity on demand | Tasks: Catalog Maintenance | 2 |

## Non-functional requirements

| ID | Requirement | Target / gate |
|---|---|---|
| BAREOS-NFR-001 | Built FROM all three `ubi{8,9,10}-secure` bases; per-base differences recorded in this doc | 3 images, differences table below |
| BAREOS-NFR-002 | Package provenance: official bareos.org repo, GPG-verified, version pinned; base digest-pinned | recorded in Dockerfile + here |
| BAREOS-NFR-003 | Image size envelope | ≤ 600 MB per image |
| BAREOS-NFR-004 | Startup: Director answers `bconsole` status | ≤ 30 s from container start |
| BAREOS-NFR-005 | Idle resource envelope (S t-shirt; tuning at runtime, never baked) | ≤ 512 MB RSS idle |
| BAREOS-NFR-006 | Runtime posture: `no-new-privileges`, SELinux confined, only ports 9101–9103 (+WebUI where enabled), daemons run as the `bareos` user where supported | verified at P3 |
| BAREOS-NFR-007 | No secrets, passwords, or keys baked into any image — per-instance at runtime (ssh_testserver precedent) | image inspection |
| BAREOS-NFR-008 | CVE budget: 0 fixable Critical; fixable Highs treated via the hardening loop | Trivy via container_security |
| BAREOS-NFR-009 | CycloneDX SBOM per image in this role's `sbom/` | build output |
| BAREOS-NFR-010 | Reproducible: Dockerfile built via `roles/podman` reproduces the image | rebuild check |
| BAREOS-NFR-011 | Role idempotence: double-converge clean during the live-role-test build | molecule/converge evidence |
| BAREOS-NFR-012 | Restore RTO: 1 GB reference dataset restored in-container | ≤ 5 min |
| BAREOS-NFR-013 | Registered in `playbooks/vars/platform_images.yml` and covered by the periodic image-hardening loop | entry present |

## Per-base differences (populated at P1/P2)

| Aspect | ubi8-secure | ubi9-secure | ubi10-secure |
|---|---|---|---|
| bareos packages (EL_8/EL_9/EL_10) | **x86_64 only — no aarch64 published** | aarch64 ✔ `25.1.0~pre17.1c4281d8e-72.el9` (built 2026-07-13) | aarch64 ✔ `…-72.el10` (built 2026-07-13) |
| Buildable on this arm64 lab | **NO — upstream gap, recorded outcome** | yes (pilot reference base) | yes |
| Image size (NFR-003 ≤ 600 MB) | n/a | 284 MB ✔ | 284 MB ✔ |
| Python interpreter | n/a | 3.9.25 | 3.12.13 |
| PostgreSQL client version | n/a | 13.23 (default EL9 stream; PG16 server-compatible on the wire) | 16.14 |
| Notable deltas / workarounds | emulated-x86_64 build = out-of-scope follow-up | disttag `.el9` appended to shared NVR pin | disttag `.el10` appended to shared NVR pin |

## P2 outcome (2026-07-13) — GREEN end-to-end on both buildable bases

`bin/bareos-image-factory.sh` exit 0: thin image built per base (pinned NVR,
GPG + repo_gpgcheck) → consumed digest-pinned RH postgresql-16 catalog
sibling → **live role converge in-container** (action server, remote catalog
schema init via the shipped scripts) → marker restart into foreground
daemons → bconsole smoke asserting the pinned build. Register:
`TEST-BAREOS-IMAGE-FACTORY-P2`. Partially satisfied already: FR-004 (full
stack deploys — director/sd/fd + sibling catalog live), NFR-001/002/003/007/
010/011 evidence collected; formal per-FR execution is P4.

**Findings ledger (10; four real role defects, all fixed):**
1. Hardened bases ship no sudo → docker-exec converge uses `become_method: su` (scenario pattern).
2. **BUG-117**: unguarded firewalld tasks (+ unguarded service tasks/handlers) — `manage_firewall`/`manage_service` toggles added.
3. **BUG-116**: Catalog resource hard-coded + schema never initialized — parameterized + idempotent `init_catalog.yml` (shipped scripts, remote-capable, ALTER ROLE password).
4. Parallel in-container dnf OOM-killed the 8GB VM → `serial: 1` (scenario pattern).
5. Packaged `bareos-dir.d` defaults defeat dir-presence entrypoint heuristics → explicit converge marker (image pattern).
6. **BUG-118**: templates unparseable on Bareos 25 (`PidDirectory` removed; deprecated sd keyword) and defaults unstartable (no Job/Client resources) → cleaned + self-backup default set + Client resource.
7. Repo files must mirror the vendor's own `.repo` verbatim (layout + `repo_gpgcheck` we'd have missed).
8. RPM pins need the per-base disttag (`.el9`/`.el10`) appended to the shared NVR.
9. **BUG-119**: `bconsole.conf` never deployed — every bconsole-driven action dead against a managed director → managed template added.
10. Play-vars password lookups re-evaluate PER REFERENCE — TLS-PSK failed as "connect refused" because dir.conf and bconsole.conf rendered different passwords → `set_fact` once (bit twice this pilot).

## P3 progress (2026-07-13) — scan, SBOM, loop registration

- Trivy scan (first pass): **bareos_ubi10 CLEAN**; **bareos_ubi9 0 Critical /
  23 High** — NFR-008's hard gate (0 fixable Critical) passes on both; the
  ubi9 Highs route into the periodic image-hardening loop (treat/rebuild).
- CycloneDX SBOMs in `sbom/` (206 components ubi9 / 197 ubi10) — NFR-009 met.
- Both images + the consumed catalog registered in
  `playbooks/vars/platform_images.yml` (build_context set → full
  treat/rebuild path; catalog scan-only) — NFR-013 met.
- Remaining P3: linux_security service-level posture pass + CMDB ingest of
  the scan results. Then P4 executes the FR cases against the live lab.

## Execution evidence

**Moved out of this file (owner rule 2026-07-16)** — a requirement/capability
document and its test-execution evidence are separate artifacts (ISO/IEC/
IEEE 29148 keeps "verification method" apart from the requirement statement;
this platform's own renderer already models that split). The full P4
per-FR verdict table (pass/fail/partial/capability-gap, with cause) that
previously lived here is **recorded in
`roles/cmdb/vars/platform_tests.yml`** under register `TEST-BAREOS-FPS-P4`
(`playbooks/bareos_fps_verify.yml`'s run against the live lab, both UBI
bases, 2026-07-13) and rendered into `TESTS.md`'s generated traceability
block — that is the single home for outcomes going forward; do not
re-duplicate results here.

Note on fidelity: the register's `evidence:` field is a prose summary, not
a per-FR table — the granular "capability gap" attribution per FR
(FR-012/013/014/016/019/020/021/022/023/024/027/029, marked inline in the
requirements table above via their `Tier` column note) was previously only
fully itemized in the table removed here. If that per-FR granularity is
wanted as a durable, queryable record rather than inline table notes, enrich
the `TEST-BAREOS-FPS-P4` register entry (or a successor run) with it instead
of restoring a duplicate table in this file.
