# mail_full

## Description

Deploys a **full mail stack** on a single host: [Postfix](https://www.postfix.org/) (MTA) +
[Dovecot](https://www.dovecot.org/) (IMAP/POP3) + [OpenDKIM](http://www.opendkim.org/)
signing + [SpamAssassin](https://spamassassin.apache.org/) and
[ClamAV](https://www.clamav.net/) antispam, with virtual mail domains and mailbox users.
Use it when you need to *host* mailboxes rather than just relay outbound mail.

This is a **product role** (one of the mail products: `mail_relay`, `mail_full`). It is
**standalone-first** — runnable on its own in a playbook — and is also **selected by the
`mail_server` dispatcher** when `mail_type: full`. Both mail products consume the **same
variable interface** (`action`, `mail_*`), so the dispatcher selects either with one
identical call and no per-product code.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld), `ansible.builtin`
- An EL target able to install Postfix, Dovecot and dovecot-pigeonhole (postfix is UBI
  AppStream; dovecot comes from the entitled RHEL AppStream — see `FPS.md`). The antispam
  chain (OpenDKIM, SpamAssassin, ClamAV, amavisd-new) is **EPEL-only on EL** and its
  sourcing is deferred (owner decision 2026-07-14) — the `antispam` action skips
  gracefully on EL and the `mail_dkim/spamassassin/clamav_enabled` toggles default off
- For DKIM/DNS: ability to publish a DKIM TXT record after key generation
- A TLS cert/key for production inbound mail

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `present` | `present`/`absent` · `configure` · `secure` · `antispam` · `add_domain` · `add_user` · `test` · `status` · `started`/`stopped`/`restarted`. Shared across both mail products. |
| `mail_execute` | `true` | Dry-run gate honoured by both mail products — set `false` to validate dispatch + variables without changing the node. |
| `mail_domain` / `mail_hostname` | `{{ ansible_domain }}` / `{{ ansible_fqdn }}` | Mail identity. Shared interface vars. |
| `mail_relay_host` / `_port` / `_user` / `_password` | `""` / `587` / `""` / `""` | Optional upstream smarthost for outbound mail. |
| `mail_tls_enabled` / `mail_tls_cert_file` / `mail_tls_key_file` / `mail_tls_security_level` | `true` / `""` / `""` / `may` | TLS settings. Shared interface vars. |
| `mail_open_smtp` / `_submission` / `_smtps` | `true` / `true` / `false` | Firewall ports 25 / 587 / 465. Shared interface vars. |
| `mail_dovecot_protocols` | `[imap, imaps]` | Dovecot listener flavours (`imap`/`imaps`/`pop3`/`pop3s` — drives listeners + firewall ports; `imaps`/`pop3s` are TLS listeners of the base protocols). |
| `mail_dovecot_mail_location` / `mail_dovecot_ssl` | `maildir:~/Maildir` / `required` | Dovecot delivery + SSL (`no` also re-allows plaintext auth — lab scope only). |
| `mail_dovecot_listen` | `*, ::` | Dovecot listen addresses (set `*` on IPv6-less containers — dovecot fatals when it cannot bind `::`). |
| `mail_dovecot_passwd_file` | `/etc/dovecot/passwd.db` | Dovecot passwd-file backing the virtual users. |
| `mail_imap_port` / `mail_imaps_port` / `mail_pop3_port` / `mail_pop3s_port` | `143` / `993` / `110` / `995` | Dovecot listener ports. |
| `mail_virtual_domains` / `mail_virtual_users` | `[]` / `[]` | Virtual mail domains and mailbox users. |
| `mail_virtual_mailbox_base` | `/var/mail/vhosts` | Virtual mailbox tree root (postfix `virtual_mailbox_base` + dovecot userdb home base). |
| `mail_vmail_user` / `mail_vmail_uid` / `mail_vmail_gid` | `vmail` / `5000` / `5000` | System account owning the virtual mailbox tree. |
| `mail_dkim_enabled` / `mail_dkim_selector` / `mail_dkim_key_size` | `false` / `mail` / `2048` | OpenDKIM signing. Default off — opendkim is EPEL-only on EL (sourcing deferred 2026-07-14). |
| `mail_spamassassin_enabled` / `_required_score` / `_rewrite_subject` | `false` / `5.0` / `false` | SpamAssassin. Default off — removed from RHEL 10, EPEL-only (sourcing deferred). |
| `mail_clamav_enabled` | `false` | ClamAV. Default off — EPEL-only on all EL bases (sourcing deferred). |
| `mail_test_recipient` | `admin@localhost` | Recipient for the `test` action. |
| `mail_new_domain` / `mail_new_user` / `mail_new_user_password_hash` | `""` | Required for the `add_domain` / `add_user` actions. |
| `mail_manage_service` | `true` | Manage/restart services (BUG-117 class — `false` on containers; guards `services.yml`, the status `systemctl` leg and the restart/reload handlers). Shared with `mail_relay`. |
| `mail_manage_firewall` | `true` | Manage firewalld ports (`false` on containers — no firewalld). |
| `mail_manage_packages` | `true` | Manage packages via dnf (`false` when a substrate image pre-bakes them; EL8 interpreter has no dnf bindings — BUG-018 class). |
| `mail_db_type` | `lmdb` on EL10+, else `hash` | Postfix lookup-table type (BUG-122). Shared with `mail_relay`. |
| `mail_mynetworks` | `[127.0.0.0/8]` | Networks permitted to relay (BUG-124 — `mynetworks` + `smtpd_relay_restrictions`). Shared with `mail_relay`. |

## Use Cases

**Standalone — build a full mailbox host end to end:**

```yaml
- hosts: mail_servers
  roles:
    - role: mail_full
      vars: { action: present }
    - role: mail_full
      vars:
        action: configure
        mail_virtual_domains: [{ name: example.com }]
    - role: mail_full
      vars: { action: secure }        # TLS + DKIM keygen
    - role: mail_full
      vars: { action: antispam }      # SpamAssassin + ClamAV + amavisd
```

**Standalone — add a mailbox user:**

```yaml
- hosts: mail_servers
  roles:
    - role: mail_full
      vars:
        action: add_user
        mail_new_user: alice@example.com
        mail_new_user_password_hash: "{{ vault_alice_hash }}"
```

**Via the `mail_server` dispatcher** (same code selects either product):

```yaml
- hosts: mail_servers
  roles:
    - role: mail_server
      vars:
        mail_action: baseline
        mail_type: full
        mail_virtual_domains: [{ name: example.com }]
```

## Testing

```bash
cd roles/mail_full && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `mail_execute: false`, so it validates
action dispatch, the shared variable contract, and the negative (bad-action) path without
installing the mail stack or touching the host. A real full-stack deployment requires a live
EL9 host (and DNS for DKIM) and is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/mail_full.md`](../../docs/mail_full.md) — internals, action workflows,
  permutations, and gotchas.
- Family index: [`docs/mail-server.md`](../../docs/mail-server.md) — the mail product family
  and the shared `mail_*` interface.
- Sibling product: `mail_relay` (Postfix smarthost relay).
- Dispatcher: `mail_server` (`mail_type`).
