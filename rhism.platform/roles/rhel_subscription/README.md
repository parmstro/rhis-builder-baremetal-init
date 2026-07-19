# rhel_subscription

## Description

Red Hat Subscription Manager (RHSM) registration — activation-key or username/password —
consumed standalone or by other product roles that need to register a host with RHSM
before installing subscription-gated content. This is a **standalone capability role**
(per the role-definition doctrine): self-contained, no product family, invoked directly
or via `include_role` from another role's tasks (the same pattern `windows_ca` uses with
`certs`).

It consolidates logic that was previously duplicated near-identically across five call
sites — `roles/rh_idm`, `roles/satellite`, `roles/gitlab_ee`, `roles/ocp`, and the
wizard's `00_licensing.yml` page — all of which only supported activation-key
registration. This role adds a username/password mode alongside it.

## Requirements

- Ansible / Python: ansible-core 2.15+
- Collections: `community.general` (for `redhat_subscription`)
- A real Red Hat entitlement (subscription or Satellite/Katello account) for any
  non-`rhel_subscription_skip: true` run

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `rhel_subscription_action` | `register` | `register` \| `unregister` |
| `rhel_subscription_method` | `activation_key` | `activation_key` \| `username_password` (only used when `rhel_subscription_action: register`) |
| `rhel_subscription_org_id` | `""` | Organization ID — required for `activation_key` method |
| `rhel_subscription_activation_key` | `""` | Activation key — required for `activation_key` method |
| `rhel_subscription_username` | `""` | access.redhat.com / Satellite / Katello username — required for `username_password` method |
| `rhel_subscription_password` | `""` | access.redhat.com / Satellite / Katello password — required for `username_password` method |
| `rhel_subscription_pool_ids` | `[]` | Subscription pool IDs to consume (either method) |
| `rhel_subscription_auto_attach` | *(unset)* | Auto-consume available subscriptions on success; left unset uses the module's own default |
| `rhel_subscription_consumer_name` | `""` | System name to register; empty uses the module default (hostname) |
| `rhel_subscription_server_hostname` | `""` | Alternative RHSM server (e.g. an on-prem Satellite); empty uses the module/subscription-manager default |
| `rhel_subscription_force_register` | `false` | Register even if already registered |
| `rhel_subscription_skip` | `false` | Master off switch — no real RHSM call for register or unregister when true |

## Use Cases

```yaml
# Standalone — activation key (the mode all 5 previously-duplicated callers used)
- hosts: all
  roles:
    - role: rhel_subscription
      vars:
        rhel_subscription_action: register
        rhel_subscription_org_id: "{{ vault_rhsm_org_id }}"
        rhel_subscription_activation_key: "{{ vault_rhsm_activation_key }}"
```

```yaml
# Standalone — username/password
- hosts: all
  roles:
    - role: rhel_subscription
      vars:
        rhel_subscription_action: register
        rhel_subscription_method: username_password
        rhel_subscription_username: "{{ vault_rhsm_username }}"
        rhel_subscription_password: "{{ vault_rhsm_password }}"
        rhel_subscription_auto_attach: true
```

```yaml
# Called from another role's tasks (e.g. rh_idm/satellite/gitlab_ee/ocp — the consolidated
# pattern replacing each role's own previously-duplicated redhat_subscription task)
- name: Register with RHSM
  ansible.builtin.include_role:
    name: rhel_subscription
  vars:
    rhel_subscription_action: register
    rhel_subscription_org_id: "{{ idm_rhsm_org_id }}"
    rhel_subscription_activation_key: "{{ idm_rhsm_activation_key }}"
    rhel_subscription_skip: "{{ idm_rhsm_skip_registration }}"
  when: not (idm_rhsm_skip_registration | bool)
```

See `tests/test.yml` for runnable end-to-end examples (needs a real host + entitlement).

## Testing

```bash
cd roles/rhel_subscription && molecule test          # standalone, contract-only (see below)
```

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | `registry.access.redhat.com/ubi9/ubi-minimal:latest` (unused — contract runs on `hosts: localhost`) | Pass |

**Scenario: default** — Tier 1 (contract-only) per `docs/testing-efficacy.md`: real RHSM
registration needs a live entitlement and external network access, so it can't run in CI.
Validates: argument-spec negative tests (bogus action, bogus method, missing
activation-key fields), the standalone default contract, and a **real dispatch** of all
three action/method combinations with `rhel_subscription_skip: true` — this exercises the
role's actual assert/branch logic end-to-end without ever calling
`community.general.redhat_subscription` for real.

### Bugfixes

_None yet — new role._

## Support / License

RHEL 9. MIT license.

## Related Information

- Depth doc: `docs/rhel_subscription.md`
- Consolidates duplicated logic previously in `roles/rh_idm/tasks/prepare_server.yml`,
  `roles/satellite/tasks/install.yml`, `roles/gitlab_ee/tasks/present.yml`,
  `roles/ocp/tasks/present.yml`, and the wizard's `00_licensing.yml`
- Upstream module: `community.general.redhat_subscription`
