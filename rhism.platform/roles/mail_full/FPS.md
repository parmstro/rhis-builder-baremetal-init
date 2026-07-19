# mail_full (Postfix + Dovecot + Sieve + antispam) — Function and Performance Specification (FPS)

Image-factory Wave artifact (/new-image; bareos-pilot standard, mail_relay
Wave-I sibling). Requirements below derive from the **product's documented
capability** — full mail server: Postfix SMTP, Dovecot IMAP/POP3/LMTP, Sieve
(Pigeonhole), antispam — not from what this role currently codes. Rows that
fail or cannot pass in container scope are recorded honestly, never dropped.

**Provenance** (reputable-sources rule, researched 2026-07-14):
- Postfix capability: https://www.postfix.org/documentation.html (official) —
  specifically https://www.postfix.org/VIRTUAL_README.html (virtual domains/
  mailboxes), https://www.postfix.org/SASL_README.html (Dovecot as smtpd SASL
  backend + client SASL to a smarthost), https://www.postfix.org/TLS_README.html
  (STARTTLS/wrappermode), https://www.postfix.org/SMTPD_ACCESS_README.html
  (relay control), https://www.postfix.org/ADDRESS_REWRITING_README.html
  (aliases/canonical), https://www.postfix.org/MILTER_README.html (DKIM hook),
  https://www.postfix.org/postconf.5.html (message_size_limit,
  virtual_transport=lmtp).
- Dovecot capability: https://doc.dovecot.org/2.3/ (official 2.3-line docs —
  the line RHEL 8/9 ship; IMAP/POP3/LMTP services, SSL/TLS, passwd-file auth,
  quota plugin, Sieve/ManageSieve via Pigeonhole).
- Red Hat mail-services documentation:
  https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/deploying_mail_servers/
  (Ch. 1 "Configuring and maintaining a Dovecot IMAP and POP3 server" — TLS
  default-on, Maildir support; plus the Postfix SMTP chapters). RHEL 10
  equivalent exists at .../red_hat_enterprise_linux/10/html/deploying_mail_servers/.
- SpamAssassin sourcing: RHEL 10 release notes, removed features —
  https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/10.0_release_notes/removed-features
  — **spamassassin is removed from RHEL 10** (libdb licensing) and routed to
  EPEL; on RHEL 8/9 it is AppStream, but its presence in the **UBI** repo
  subset is unproven → **P2 probe item** (see per-base table).
- Package sourcing probe (2026-07-14, this lab, org activation key / Simple
  Content Access): **dovecot and dovecot-pigeonhole are NOT in the UBI
  repos**; they resolve from the entitled `rhel-9-for-aarch64-appstream-rpms`
  as **dovecot 1:2.3.16-18.el9_8** and **dovecot-pigeonhole 2.3.16-18.el9_8**.
  **postfix IS in plain UBI AppStream** on all three bases (proven by the
  mail_relay Wave-I images: 3.5.8 el8 / 3.5.25 el9 / 3.8.5 el10).
- Build pattern (entitled wave): ubiN-secure base + postfix from UBI +
  dovecot/dovecot-pigeonhole from entitled repos via a **single-layer,
  secret-mounted `subscription-manager register → dnf install → unregister →
  clean` pattern** — the activation key/org values live only in an untracked
  `./activation-key` file and are never referenced in any tracked file or
  baked into any image layer.
- Version cross-check (derivative-mirror evidence, exact entitled NVRs to be
  confirmed at P2 probe): EL8 current dovecot stream is **2.3.16** (el8_10
  builds; the original 8.0 GA 2.3.8 was rebased upstream of us), EL10 ships
  **2.3.21** (2.3.21-16.el10 per the RHEL 10 package manifest /
  EL10-rebuild rpms — NOT the 2.4 line;
  https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/package_manifest/content).

**Scope**: role `mail_full` (mail family product; dispatcher `mail_server`).
Container lab on `ubi{8,9,10}-secure`: the full-stack image + sibling
sender/client containers. Container-scope ground rules: **no systemd** (the
role's `ansible.builtin.service` / `systemctl` paths need manage_service-style
toggles — BUG-117 class — with foreground/direct daemon start in the factory:
`/usr/sbin/dovecot` + `postfix start`), **no firewalld** (present.yml's port
tasks likewise need a manage_firewall gate), **self-signed TLS** for all test
legs, and the Wave-I smoke standard: **every smoke includes at least one real
protocol exchange** (SMTP dialogue, IMAP LOGIN/FETCH) — TCP-connect +
config-check is not a smoke (BUG-124 lesson). Out of container scope: real
DNS (MX routing, DKIM/SPF TXT verification), internet mail delivery,
freshclam signature downloads (runs default offline).

## Functional requirements

FR-001..002 pre-exist in `REQUIREMENTS.yml` (family interface dry-run, lab
e2e send/receive). FR-003+ are capability-derived for the image-factory wave.
Statuses land in the outcomes table below at P4/P5; `verified_by` in
REQUIREMENTS.yml stays empty (UNCOVERED) until then — deliberate.

| ID | The system SHALL… | Source | Container-scope expectation |
|---|---|---|---|
| MAILFULL-FR-003 | deploy the complete stack — Postfix MTA + Dovecot IMAP/POP3/LMTP + Sieve (Pigeonhole) + antispam — via this role's actions | RHEL 9 Deploying mail servers; postfix.org STANDARD_CONFIGURATION_README | testable — the image build IS the live role test |
| MAILFULL-FR-004 | accept inbound SMTP on :25 for hosted virtual domains and reject unknown recipients | VIRTUAL_README; SMTPD_ACCESS_README | testable (real SMTP exchange) |
| MAILFULL-FR-005 | serve authenticated submission on :587 (RFC 6409), authentication required before relay | postconf master submission service; SASL_README | testable — role templates master.cf; submission+SASL wiring verified at P4 |
| MAILFULL-FR-006 | deliver accepted mail into per-user Maildir via Dovecot LMTP (`virtual_transport = lmtp:unix:...`) | https://doc.dovecot.org/2.3/ (LMTP server); postfix lmtp(8) | testable — role currently delivers via virtual(8) mailbox maps, not LMTP: capability gap, expected FAIL until the wave item lands |
| MAILFULL-FR-007 | authenticate an IMAP4rev1 session and FETCH a delivered message on :143 (STARTTLS) and :993 (implicit TLS) | doc.dovecot.org/2.3/ IMAP; RHEL 9 Dovecot chapter | testable (openssl s_client + LOGIN/SELECT/FETCH — real protocol) |
| MAILFULL-FR-008 | serve POP3 retrieval on :110 (STARTTLS) and :995 (implicit TLS) | doc.dovecot.org/2.3/ POP3; RHEL packages pop3 in the base dovecot RPM | testable — role default `mail_dovecot_protocols` omits pop3 (interface supports it); enable in the scenario |
| MAILFULL-FR-009 | offer STARTTLS on SMTP/submission and IMAP/POP3, plus implicit-TLS variants (465/993/995), with auth refused on plaintext | TLS_README; dovecot `ssl = required` | testable with self-signed certs (certs role precedent) |
| MAILFULL-FR-010 | authenticate SMTP clients via Dovecot as Postfix's SASL backend (`smtpd_sasl_type = dovecot`, auth socket) | SASL_README (Dovecot SASL section) | testable — role templates do not wire smtpd SASL to Dovecot today: capability gap, expected FAIL until wave item |
| MAILFULL-FR-011 | refuse open relay: unauthenticated mail for non-hosted domains rejected | SMTPD_ACCESS_README | testable (negative case) |
| MAILFULL-FR-012 | provision virtual mail domains at runtime (role `add_domain` action) | VIRTUAL_README; role action | testable |
| MAILFULL-FR-013 | provision virtual mailbox users with passwd-file authentication (role `add_user` action) | doc.dovecot.org/2.3/ passwd-file auth | testable |
| MAILFULL-FR-014 | rewrite addresses via virtual alias maps and local aliases (newaliases) | ADDRESS_REWRITING_README | testable |
| MAILFULL-FR-015 | filter mail at delivery time with Sieve (Pigeonhole) — e.g. `fileinto` a folder | doc.dovecot.org/2.3/ Sieve (Pigeonhole); entitled dovecot-pigeonhole pkg | testable in principle — role has NO sieve configuration at all: capability gap, expected FAIL until wave item |
| MAILFULL-FR-016 | serve ManageSieve (:4190) for client-side Sieve script management | doc.dovecot.org/2.3/ ManageSieve (Pigeonhole) | role capability gap — expected FAIL until wave item |
| MAILFULL-FR-017 | enforce per-user mailbox quota (Dovecot quota plugin) | doc.dovecot.org/2.3/ quota plugin | role capability gap (`mail_mailbox_size_limit` reaches Postfix only) — expected FAIL until wave item |
| MAILFULL-FR-018 | score and tag spam via SpamAssassin in the delivery path (role `antispam` action) | https://spamassassin.apache.org/ ; RHEL 8/9 AppStream | sourcing-gated: UBI presence = P2 probe (EPEL-only on EL10); role's Debian-style paths (`/etc/default/spamassassin`, `/etc/amavis/conf.d`) will not converge on EL — expected FAIL until fixed |
| MAILFULL-FR-019 | scan mail for malware via ClamAV through an amavisd-new content filter | https://docs.clamav.net/ ; amavis upstream | expected FAIL — clamav/clamav-update/amavisd-new are in NO RHEL repo (EPEL-only, all three bases): sourcing-exception decision at P2; freshclam also needs network (runs default offline) |
| MAILFULL-FR-020 | DKIM-sign outbound mail via the OpenDKIM milter (role `secure` action: key generation + DNS TXT guidance) | MILTER_README; http://www.opendkim.org/ | partial — opendkim is EPEL-only (P2 sourcing decision); local signing testable if sourced, DNS TXT verification (`opendkim-testkey`) expected FAIL — no real DNS in scope |
| MAILFULL-FR-021 | relay outbound mail through a configured smarthost with client SASL (`mail_relay_*` shared vars) | SASL_README (client side); RELAY_README | testable — reuse the Wave-I smarthost-catcher sibling pattern |
| MAILFULL-FR-022 | enforce message size limits (`mail_message_size_limit`) | postconf.5 message_size_limit | testable (oversize rejected with 552) |
| MAILFULL-FR-023 | expose queue visibility and service health via the role's `status` action, and send a REAL message via the `test` action | postfix mailq/postqueue; role status/test actions | testable — status.yml's `systemctl` leg expected FAIL in-container (no systemd); real-send leg is the smoke standard |

## Non-functional requirements

| ID | Requirement | Target / gate |
|---|---|---|
| MAILFULL-NFR-001 | Built FROM all three `ubi{8,9,10}-secure` bases; per-base differences recorded in this doc | 3 images, differences table below |
| MAILFULL-NFR-002 | Package provenance: postfix from UBI AppStream (UBI-stream pinning rule: base digest + SBOM NVRs); dovecot/dovecot-pigeonhole from entitled repos via single-layer secret-mounted subscription-manager register→install→unregister→clean; no key/org values in any tracked file or image layer | recorded in Containerfile + here |
| MAILFULL-NFR-003 | Image size envelope (core stack, antispam add-ons excluded until sourced) | ≤ 450 MB per image |
| MAILFULL-NFR-004 | Startup: SMTP banner on :25 AND IMAP greeting on :143 answered | ≤ 20 s from container start |
| MAILFULL-NFR-005 | Idle resource envelope, core stack (S t-shirt; tuning at runtime, never baked; clamd's signature DB documented separately if ever sourced) | ≤ 256 MB RSS idle |
| MAILFULL-NFR-006 | Runtime posture: `no-new-privileges`, SELinux confined, only mail ports (25/587/143/993 + 110/995/4190 where enabled); Postfix and Dovecot child processes drop to their unprivileged service users (`postfix`, `dovecot`/`dovenull`, `vmail`); master daemons need in-container root for <1024 binds — unprivileged on the host under rootless podman | verified at P4 |
| MAILFULL-NFR-007 | No secrets baked into any image: no user password hashes, TLS keys, DKIM keys, SASL credentials — and no subscription/entitlement residue in any layer (`subscription-manager clean` verified) | image inspection |
| MAILFULL-NFR-008 | CVE budget: 0 fixable Critical; fixable Highs treated via the hardening loop | Trivy via container_security |
| MAILFULL-NFR-009 | CycloneDX SBOM per image in this role's `sbom/` | build output |
| MAILFULL-NFR-010 | Reproducible: Containerfile built via `roles/podman` reproduces the image | rebuild check |
| MAILFULL-NFR-011 | Role idempotence: double-converge clean during the live-role-test build | converge evidence |
| MAILFULL-NFR-012 | Mail round-trip RTO: message accepted on :587 is FETCHable via IMAP | ≤ 30 s |
| MAILFULL-NFR-013 | Registered in `playbooks/vars/platform_images.yml` and covered by the periodic image-hardening loop | entry present |

## Per-base differences (populated at P1/P2)

| Aspect | ubi8-secure | ubi9-secure | ubi10-secure |
|---|---|---|---|
| postfix (UBI AppStream) | 3.5.8-8.el8_10 ✔ | 3.5.25-3.el9_8 ✔ | 3.8.5-10.el10_2 ✔ |
| dovecot (entitled AppStream) | **2.3.16-7.el8_10 ✔ built 2026-07-14** (2.3.16 stream confirmed) | **2.3.16-18.el9_8 ✔ built 2026-07-14** | **2.3.21-19.el10_2 ✔ built 2026-07-14** (2.3.21 line confirmed, not 2.4) |
| dovecot-pigeonhole (entitled) | 2.3.16-7.el8_10 ✔ | 2.3.16-18.el9_8 ✔ | 2.3.21-19.el10_2 ✔ |
| Image size (substrate, P2) | **481 MB — exceeds the ≤450 MB NFR-003 envelope** (base itself is +109 MB vs ubi9; honest miss, verdict formalized at P4) | 364 MB ✔ | 362 MB ✔ |
| Entitled-layer residue check (P2) | consumer/entitlement dirs EMPTY, identity unregistered, no key/org values in image history ✔ | same ✔ | same ✔ |
| Postfix lookup-table type | hash bundled | hash bundled | lmdb (hash unbundled/deprecated — BUG-122, EL-aware `mail_db_type`) |
| spamassassin | RHEL AppStream; **UBI presence = P2 probe** | RHEL AppStream; **UBI presence = P2 probe** | **NOT in RHEL 10 — EPEL only** (removed, libdb licensing) |
| opendkim / clamav / amavisd-new | EPEL-only (no RHEL repo) — sourcing-exception decision at P2 | EPEL-only — same decision | EPEL-only — same decision |
| Notable deltas / workarounds | — | entitled-wave reference base (probe done) | lmdb map type; antispam sourcing hardest here |

## Outcomes — P4/P5 execution (placeholder)

Populated when `playbooks/`-driven FPS verification executes the FR cases
against the live per-base images (register `TEST-MAILFULL-FPS-P4`).
Failures stay in this table — they are the honest gap record this FPS
exists to expose.

| FR | Verdict (per base) | Evidence / cause |
|---|---|---|
| FR-003 | PASS ×3 | Full stack deployed via present/configure/add_domain/add_user — the build IS the live role test (ubi9 ok=45, ubi8 ok=44, ubi10 ok=45, failed=0) |
| FR-004 | PASS ×3 | Real SMTP exchange to :25 — hosted-domain RCPT accepted, DATA accepted (LEG1 SMTP-ACCEPT-OK) |
| FR-007 | PASS ×3 (plaintext :143) | IMAP LOGIN+SELECT+FETCH of the delivered message (LEG2 IMAP-FETCH-OK); STARTTLS/:993 = FR-009 wave item |
| FR-011 | PASS ×3 | Unknown recipient rejected 550 (LEG3); relay for non-hosted domain denied 554 (LEG4) — anti-relay proven (BUG-135 fix) |
| FR-012 | PASS ×3 | add_domain provisioned a virtual domain (BUG-137 map-deployment fix) |
| FR-013 | PASS ×3 | add_user provisioned a virtual mailbox user (doveadm pw SHA512-CRYPT in-container) |
| FR-005 / FR-010 | NOT RUN | Submission SASL-via-Dovecot — expected-FAIL wave item (role capability gap) |
| FR-006 / FR-015 / FR-016 / FR-017 | NOT RUN | LMTP / Sieve / ManageSieve / quota — expected-FAIL wave items |
| FR-009 | NOT RUN | TLS legs — factory ran mail_tls_enabled=false (plaintext IMAP); wave item |
| FR-018 / FR-019 / FR-020 | NOT RUN | Antispam/malware/DKIM — EPEL-only, owner-deferred (BUG-139) |

**P3 run (2026-07-14): GREEN ×3** — 4 real protocol legs per base. 8 role
defects found+fixed (BUG-132..139) + 1 latent sibling in mail_relay (BUG-140,
open). Register: TEST-MAILFULL-FACTORY-P3.

**P4 security gate (2026-07-14): PASS ×3** — Trivy scan 0 fixable Critical on
all bases (ubi10 0H CLEAN; ubi8 35H / ubi9 24H = base backlog → hardening
loop, product adds ~0). CycloneDX SBOMs ×3 in `sbom/`, published to
ansible-platform-sboms. NFR-003 size: ubi9 364 / ubi10 362 MB ✔, ubi8 481 MB
(recorded miss). Registered `build_context` in platform_images.yml. NFR-011:
P3 ran converge×2 clean, but add_domain/add_user postmap tasks are
changed_when:true by design — a strict idempotence pass is deferred to the
next hardening-loop run (documented, not silently skipped).

## Role findings ledger (pre-P1, from FPS authoring 2026-07-14)

Recorded here so the wave items are not lost; none of these change the FR
set — they are why several rows above are expected FAILs today:

1. `present.yml` firewalld tasks and `services.yml`/`antispam.yml` service
   tasks are ungated for container scope — needs the BUG-117 pattern
   (`manage_firewall`/`manage_service` toggles).
2. Debian-isms that cannot converge on EL: package names (`dovecot-imapd`,
   `amavisd-new`, `mailx` on EL9+), `/etc/default/spamassassin`,
   `/etc/amavis/conf.d`, service name `amavis`. Needs EL-native package/path
   set before the factory build.
3. No LMTP delivery, no smtpd-SASL-via-Dovecot wiring, no Sieve/ManageSieve,
   no Dovecot quota — product capabilities the role cannot yet configure
   (FR-006/010/015/016/017).
4. `status.yml` shells out to `systemctl` for OpenDKIM — systemd-only leg.
