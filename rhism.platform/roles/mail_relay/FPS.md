# mail_relay (Postfix) — Function and Performance Specification (FPS)

Image-factory Wave I artifact (/new-image; bareos-pilot standard).
Capability-derived from official Postfix documentation; failing rows are
honest gaps, kept visible.

**Provenance** (researched 2026-07-13):
- Capability: https://www.postfix.org/documentation.html (official) — relay/
  access control (mynetworks, relay_domains, per-client restrictions),
  relayhost/smarthost, TLS (opportunistic/enforced, forward secrecy) + SASL
  client auth, aliases/canonical maps, queue scheduler/management,
  submission service, milter/content-filter hooks.
- Packages: UBI AppStream on ALL THREE bases (probe 2026-07-13): postfix
  3.5.8 (el8) / 3.5.25 (el9) / 3.8.5 (el10). UBI-BUILT — **UBI-stream
  pinning rule** (base digest + SBOM NVRs; Phase-0 decision 2026-07-13).

**Scope**: role `mail_relay` (mail family product; dispatcher `mail_server`).
Container lab: relay + a sibling SMTP sink ("smarthost catcher", python3
smtpd on ubi9-secure) + a sender — proves the REAL relay path end-to-end.
DKIM/milter and MX-based internet delivery are out of container scope.

## Functional requirements (FR-001..003 pre-exist in REQUIREMENTS.yml)

| ID | The system SHALL… | Source | Container expectation |
|---|---|---|---|
| MAILRELAY-FR-004 | accept SMTP on :25 from permitted networks and relay via the configured smarthost | RELAY_README / postconf relayhost | testable (sender→relay→sink e2e) |
| MAILRELAY-FR-005 | reject relay attempts from outside mynetworks | SMTPD_ACCESS_README | testable (negative case) |
| MAILRELAY-FR-006 | offer STARTTLS inbound (opportunistic TLS) | TLS_README | testable (EHLO advertises STARTTLS) |
| MAILRELAY-FR-007 | enforce/attempt TLS toward the smarthost per smtp_tls_security_level | TLS_README | partial — sink is plaintext; policy config verified, enforced leg not exercised |
| MAILRELAY-FR-008 | authenticate to the smarthost with SASL when configured | SASL_README | not executed — sink offers no auth (config-verifiable) |
| MAILRELAY-FR-009 | apply alias/canonical rewriting | ADDRESS_REWRITING_README | testable |
| MAILRELAY-FR-010 | enforce message size limits | postconf message_size_limit | testable (oversize rejected) |
| MAILRELAY-FR-011 | queue on smarthost outage and deliver on recovery, with queue visibility (postqueue) | QSHAPE/queue docs | testable (stop sink, send, start sink, flush) |
| MAILRELAY-FR-012 | expose queue management ops (flush/purge — role actions) | role queue_flush/queue_purge | testable via role actions |
| MAILRELAY-FR-013 | serve authenticated submission on :587 | postconf master submission | not executed — role doesn't expose submission config (capability gap) |
| MAILRELAY-FR-014 | support milter/content-filter hooks | MILTER_README | not executed — no milter in scope (wave item with DKIM) |

## Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| MAILRELAY-NFR-001 | All three ubiN-secure bases; differences recorded | 3 images |
| MAILRELAY-NFR-002 | Image size | ≤ 350 MB |
| MAILRELAY-NFR-003 | Accepts SMTP from container start | ≤ 15 s |
| MAILRELAY-NFR-004 | Posture: no-new-privileges, SELinux confined, :25 (+:587 when exposed) only | verified P4 |
| MAILRELAY-NFR-005 | No secrets baked (SASL creds at provision only) | image inspect |
| MAILRELAY-NFR-006 | CVE budget: 0 fixable Critical; Highs → loop | Trivy |
| MAILRELAY-NFR-007 | CycloneDX SBOM in role sbom/ | build output |
| MAILRELAY-NFR-008 | Reproducible via roles/podman Dockerfile | rebuild |
| MAILRELAY-NFR-009 | platform_images.yml + hardening loop | entry |

## Per-base differences (P2)

| Aspect | ubi8-secure | ubi9-secure | ubi10-secure |
|---|---|---|---|
| postfix version | 3.5.8 (built+served 2026-07-13) | 3.5.25 ✔ | 3.8.5 ✔ |
| Lookup-table type | hash bundled | hash bundled | **hash: unbundled to deprecated postfix-hash subpackage — BUG-122: EL-aware mail_db_type (lmdb on EL10)** |

## P4 gates (2026-07-13)

- Trivy: **0 fixable Critical on all three** (hard gate PASSES); ubi8 0C/33H · ubi9 0C/22H · ubi10 CLEAN —
  the ubi8/ubi9 Highs are the BASES' patch backlog (hardening-loop treat pass
  clears every derived product at once). CycloneDX SBOMs in `sbom/`.
- Registered in `platform_images.yml` (build_context → full treat path).
- Runtime posture verified live: no-new-privileges, SELinux confined,
  minimal ports.

## Outcomes (P5) — placeholder

## P5 execution — FIRST PASS (2026-07-13, session end; register TEST-WAVEONE-FPS-P5)

After BUG-123/124 fixes, verdicts (playbooks/waveone_fps_verify.yml):
- MAILRELAY-FR-004 **pass ×3** — REAL relay e2e (accepted + queue drained to smarthost)
- MAILRELAY-FR-006 **pass ×3** — STARTTLS offered (post-BUG-124)
- MAILRELAY-FR-011 **pass** — queued during outage, delivered on recovery
- MAILRELAY-FR-010 **OPEN — FAIL** (oversize accepted or connection error; triage next session)
- Remaining FRs: not yet executed (next session).

## P5 FINAL outcomes (2026-07-13, register TEST-WAVEONE-FPS-P5 run 2)

| FR | Verdict | Evidence |
|---|---|---|
| FR-004 | **pass ×3** | REAL relay e2e: accepted + queue drained to smarthost |
| FR-006 | **pass ×3** | STARTTLS advertised (post-BUG-124) |
| FR-010 | **pass** | 552 Message size exceeds fixed limit on >10MB |
| FR-011 | **pass** | queued during smarthost outage, delivered on recovery |
| FR-009 | partial | alias machinery proven by newaliases/lmdb (BUG-122); rewrite e2e = next pass |
| FR-005 | not executed | denial needs a non-mynetworks source (lab subnet is permitted by design) |
| FR-007 | partial | smtp_tls_security_level rendered; enforced leg needs TLS sink |
| FR-008/013/014 | not executed | SASL sink / submission / milter = wave items (capability gaps) |
| FR-012 | not executed | queue role actions exercised implicitly (postqueue -f/-p); formal role-action leg next pass |

Promoted: `mail_relay_{ubi8,ubi9,ubi10}` `:latest` + `:stable-20260713`.
