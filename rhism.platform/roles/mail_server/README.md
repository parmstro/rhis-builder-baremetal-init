# mail_server

Mail server role — Postfix relay (outbound smarthost) or full stack with Dovecot IMAP, DKIM, SpamAssassin, and ClamAV.

## Actions

| `mail_action` | Description |
|---|---|
| `install` | Install packages for the selected type |
| `configure` | Deploy configuration templates |
| `secure` | TLS certificates, DKIM key generation |
| `baseline` | Install + configure + secure in dependency order |

## Types

| `mail_type` | Description |
|---|---|
| `relay` | Postfix outbound SMTP relay/smarthost only |
| `full` | Postfix + Dovecot IMAP + opendkim + SpamAssassin + ClamAV |

## Requirements

- RHEL/CentOS 8 or 9
- `become: true` — all tasks require privilege escalation
- `mail_install_execute: true` required to install packages (default: false — dry run)
- DKIM DNS TXT record must be added manually after `secure` action (displayed in task output)

## Variables

```yaml
# Required
mail_action: baseline          # install | configure | secure | baseline
mail_type: relay               # relay | full

# Gate (default false — dry run)
mail_install_execute: false

# Orchestrator toggles (baseline action)
mail_apply_install: true
mail_apply_configure: true
mail_apply_secure: true

# Core settings
mail_domain: example.com
mail_hostname: mail.example.com
mail_no_log: true              # set false in dev to see API output

# Relay-specific
mail_relay_host: smtp.sendgrid.net
mail_relay_port: 587
mail_relay_user: apikey
mail_relay_password: ""        # vault-backed, no_log: true

# TLS (full type + relay with STARTTLS)
mail_tls_cert: /etc/ssl/certs/mail.crt
mail_tls_key: /etc/ssl/private/mail.key
mail_tls_source_cert: ""       # path to cert on control node (optional)
mail_tls_source_key: ""        # path to key on control node (optional)

# Dovecot (full type only)
mail_imap_ssl: true
mail_imap_protocols: "imap imaps"

# DKIM (full type only)
mail_dkim_selector: mail
mail_dkim_key_size: 2048

# SpamAssassin (full type only)
mail_spam_required_score: "6.0"

# ClamAV (full type only)
mail_clamav_freshclam_enabled: true
```

## Example playbooks

```yaml
- name: Deploy Postfix relay
  hosts: mail_servers
  vars:
    mail_action: baseline
    mail_type: relay
    mail_domain: example.com
    mail_hostname: mail.example.com
    mail_install_execute: true
    mail_relay_host: smtp.sendgrid.net
    mail_relay_port: 587
    mail_relay_user: apikey
    mail_relay_password: "{{ vault_sendgrid_key }}"
  roles:
    - role: mail_server
```

```yaml
- name: Deploy full mail stack
  hosts: mail_servers
  vars:
    mail_action: baseline
    mail_type: full
    mail_domain: example.com
    mail_hostname: mail.example.com
    mail_install_execute: true
    mail_tls_source_cert: files/certs/mail.crt
    mail_tls_source_key: files/certs/mail.key
  roles:
    - role: mail_server
```

## DKIM setup

After the `secure` action, Ansible displays the DNS TXT record to add:

```
_domainkey TXT "v=DKIM1; k=rsa; p=<public key>"
```

Add this record to your DNS before enabling DKIM in the Postfix milter configuration.

## Molecule scenarios

| Scenario | What it tests |
|---|---|
| `default` | Dispatcher validation + type var loading + negative tests |
| `relay` | Postfix relay install dry-run on RHEL9 UBI |

## Tags

- `mail_server` — all tasks
- `mail_server-install` — install phase
- `mail_server-configure` — configuration phase
- `mail_server-secure` — TLS + DKIM phase

## CI

```bash
bash bin/mail-server-ci.sh
```

Phase toggles: `MAIL_DO_LINT=false`, `MAIL_DO_SECRETS=false`, `MAIL_DO_MOLECULE=false`

On macOS (run via Podman Machine):

```bash
podman machine ssh "cd '$PWD' && bash bin/mail-server-ci.sh"
```

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9/ubi:latest | All dispatcher + dry-run tests pass |

**Scenario: default** — validates dispatcher routing and variable loading for both mail types without a real Postfix/Dovecot instance:

| Test | What is verified |
|---|---|
| `baseline` (relay, no-op) | `mail_type: relay` vars loaded; all apply flags false; completes cleanly |
| `baseline` (full, no-op) | `mail_type: full` vars loaded; all apply flags false; completes cleanly |
| `install` (relay, dry-run) | `mail_install_execute: false` skips Postfix install; task logic exercised |
| `install` (full, dry-run) | `mail_install_execute: false` skips Postfix + Dovecot install; task logic exercised |
| Dispatcher rejects invalid `mail_action` | `bogus_action` raises assertion error (caught in rescue block) |
| Dispatcher rejects invalid `mail_type` | `bogus_type` raises assertion error (caught in rescue block) |

Full mail server deployment (Postfix, Dovecot, DKIM, SpamAssassin, ClamAV) requires a RHEL/Rocky target with network access to package repos and valid DNS/MX configuration.
