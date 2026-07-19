# firewall

Declarative firewalld rule management: zones, sources, interfaces,
masquerade, services, ports, ICMP blocks, and rich rules, driven by one
`firewall` list variable.

## Description

A standalone capability role (per the platform role-definition doctrine).
Each entry in the `firewall` list is a rule set; every recognised key that is
present produces its corresponding firewalld call. The role is a clean no-op
when the list is empty, so it is safe to include unconditionally — which is
exactly how the `linux_security` orchestrator consumes it
(`linux_security_apply_firewall` toggle).

## Requirements

- `ansible.posix` collection (in the platform base EE).
- A target host running firewalld (EL 9/10). Container targets generally
  cannot run firewalld (dbus + netfilter surface) — see Testing.

## Role Variables

| Variable | Default | Description |
|---|---|---|
| `firewall` | `[]` | List of rule-set entries — see below. |

Recognised keys per entry (all optional): `zone` (str), `source` (str or
list), `interface` (str), `masquerade` (bool), `service` (str or list),
`port` (str or list, e.g. `8080/tcp`), `icmp_block` (str), `rich_rule` (str —
legacy alias key `rule` also honoured), `state` (default `enabled`),
`permanent` (default `true`), `immediate` (bool).

`service`, `port`, and `source` accept a single string or a list — scalar
strings are normalised, never character-iterated (BUG-098).

## Use Cases / Example Playbooks

Standalone:

```yaml
- hosts: webservers
  become: true
  roles:
    - role: firewall
      vars:
        firewall:
          - zone: nginx
            port:
              - 8080/tcp
              - 8089/tcp
            source:
              - 10.10.10.5
          - rich_rule: 'rule family=ipv4 forward-port port=21 protocol=tcp to-port=1000-2000 to-addr=10.10.10.2 accept'
```

Via the `linux_security` orchestrator:

```yaml
- hosts: all
  become: true
  roles:
    - role: linux_security
      vars:
        linux_security_apply_firewall: true
        firewall:
          - zone: public
            service: https
```

## Testing

`molecule test -s default` runs a Tier 1 (contract-only) scenario: interface
defaults, argument-spec negative test, dispatch-file presence, and the
string-vs-list normalisation guard. Real firewalld application requires a
non-container host and is covered by `linux_security`'s Tier 3 lab coverage
(firewalld cannot start in minimal CI containers — same class as the
documented auditd/sysctl container limits).

## Molecule test results

| Scenario | Result | Date |
|---|---|---|
| default (Tier 1 contract) | PASS | 2026-07-11 |

**Bugfixes**: BUG-098 — scalar `service:`/`port:` values looped per-character
(`is iterable` is true for strings); README/code key mismatch for
`rich_rule` (code read only `rule`); non-FQCN `firewalld` calls. All fixed
2026-07-11 during the standalone-first scaffolding pass.

## Support/License

MIT. Vendored into `rhism.platform` from the platform's standalone `firewall` role.

## Related Information

- `docs/linux-security-project-intent.md` — the consuming orchestrator.
- Platform role-definition doctrine — CLAUDE.md (canonical:
  `ansible-platform-conventions`).
