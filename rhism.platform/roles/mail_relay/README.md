# mail_relay

## Description

Configures [Postfix](https://www.postfix.org/) as an outbound SMTP **relay (smarthost)** —
a lightweight MTA that forwards all mail through an upstream provider (e.g. SendGrid, a
company relay) over TLS with SASL authentication. It also manages the Postfix service, the
firewall ports, and the mail queue (flush / purge).

This is a **product role** (one of the mail products: `mail_relay`, `mail_full`). It is
**standalone-first** — runnable on its own in a playbook — and is also **selected by the
`mail_server` dispatcher** when `mail_type: relay`. Both mail products consume the **same
variable interface** (`action`, `mail_*`), so the dispatcher selects either with one
identical call and no per-product code.

## Requirements

- Ansible: 2.15+ · Collections: `ansible.posix` (firewalld), `ansible.builtin`
- An EL9 target able to install `postfix` and `mailx`
- For a real relay: an upstream smarthost (`mail_relay_host`) and, optionally, SASL
  credentials (`mail_relay_user` / `mail_relay_password`) and a TLS cert/key

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `present` | `present`/`absent` · `configure` · `secure` · `test` · `status` · `started`/`stopped`/`restarted` · `queue_flush`/`queue_purge`. Shared across both mail products; the dispatcher passes it in. |
| `mail_execute` | `true` | Dry-run gate honoured by both mail products — set `false` to validate dispatch + variables without changing the node. |
| `mail_domain` | `{{ ansible_domain }}` | Mail domain (`mydomain`/`myorigin`). Shared interface var. |
| `mail_hostname` | `{{ ansible_fqdn }}` | Mail hostname (`myhostname`). Shared interface var. |
| `mail_relay_host` | `""` | Upstream smarthost (empty = direct delivery). |
| `mail_relay_port` | `587` | Upstream smarthost port. |
| `mail_relay_user` / `mail_relay_password` | `""` | SASL credentials for the smarthost (vault-backed). |
| `mail_tls_enabled` | `true` | Enable SMTP TLS. Shared interface var. |
| `mail_tls_cert_file` / `mail_tls_key_file` | `""` | PEM cert / key paths. |
| `mail_tls_security_level` | `may` | Postfix TLS security level. |
| `mail_open_smtp` / `mail_open_submission` / `mail_open_smtps` | `true`/`true`/`false` | Firewall ports 25 / 587 / 465. Shared interface vars. |
| `mail_test_recipient` | `admin@localhost` | Recipient for the `test` action. |
| `mail_queue_purge_confirm` | `false` | Safety gate for the destructive `queue_purge` action. |

## Use Cases

**Standalone — install + configure a relay through a smarthost:**

```yaml
- hosts: mail_servers
  roles:
    - role: mail_relay
      vars: { action: present }
    - role: mail_relay
      vars:
        action: configure
        mail_relay_host: smtp.sendgrid.net
        mail_relay_user: apikey
        mail_relay_password: "{{ vault_sendgrid_key }}"
```

**Standalone — flush the mail queue:**

```yaml
- hosts: mail_servers
  roles:
    - role: mail_relay
      vars: { action: queue_flush }
```

**Via the `mail_server` dispatcher** (same code selects either product):

```yaml
- hosts: mail_servers
  roles:
    - role: mail_server
      vars:
        mail_action: baseline
        mail_type: relay
        mail_relay_host: smtp.sendgrid.net
```

## Testing

```bash
cd roles/mail_relay && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `mail_execute: false`, so it validates
action dispatch, the shared variable contract, and the negative (bad-action) path without
installing Postfix or touching the host. A real relay deployment requires a live EL9 host and
an upstream smarthost, and is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9. License: MIT.

## Related Information

- Depth doc: [`docs/mail_relay.md`](../../docs/mail_relay.md) — internals, action workflows,
  permutations, and gotchas.
- Family index: [`docs/mail-server.md`](../../docs/mail-server.md) — the mail product family
  and the shared `mail_*` interface.
- Sibling product: `mail_full` (Postfix + Dovecot + DKIM + SpamAssassin + ClamAV).
- Dispatcher: `mail_server` (`mail_type`).
