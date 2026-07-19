# tang

## Description

Tang / NBDE (Network-Bound Disk Encryption) key-escrow server. Deploys the
**official, digest-pinned Red Hat `rhel9/tang` container** — no custom-built
image — and verifies the deployment with a real `clevis encrypt tang | clevis
decrypt` round-trip, the same functional check upstream RHIS itself relies
on. rhism alignment Phase C item (`docs/rhism-alignment-plan.md`): the
smallest of the four original reuse-map gaps, and a genuinely lightweight,
fully Ansible-native example of the platform's own posture applied to a real
security capability (automated disk-encryption unlock, no manual passphrase
at boot).

Client-side LUKS/clevis binding (the part that actually encrypts a host's
disks and points them at this server) is deliberately **out of scope** —
that logic lives with host-provisioning/kickstart concerns (Phase C item 2),
not the Tang server itself. Key rotation is an **honest, documented gap**:
upstream RHIS doesn't automate it either — see [Related Information](#related-information).

## Requirements

- A host with `podman` available (this role reuses `roles/podman` for all
  container mechanics — no direct `containers.podman` calls of its own).
- Network access to `registry.redhat.io` to pull the official image.
- `clevis` (installed automatically by the `verify` action, toggleable via
  `tang_manage_packages`) to drive the round-trip check.

## Role Variables

| Variable | Default | Description |
|---|---|---|
| `action` | `deploy` | `deploy`, `verify` |
| `tang_image_repository` | `registry.redhat.io/rhel9/tang` | Official image repository |
| `tang_image_tag` | `latest` | Tag used only to PULL (see note below) |
| `tang_image_digest` | `sha256:6e94ae1...` | Digest the running container actually resolves to |
| `tang_container_name` | `tang` | Container name |
| `tang_port` | `8080` | TCP port, host and container |
| `tang_volume_name` | `tang-keys` | Named podman volume persisting `/var/db/tang` |
| `tang_manage_selinux` | `true` | Apply the `tangd_port_t` SELinux port label |
| `tang_manage_firewall` | `true` | Open `tang_port` in firewalld's public zone |
| `tang_manage_packages` | `true` | Install `clevis` for the verify round-trip |
| `tang_verify_test_string` | `tang-verify-round-trip-check` | Plaintext used by `verify` |
| `tang_verify_url` | `http://<default IPv4>:<tang_port>` | URL clevis uses to reach Tang |
| `tang_deploy_execute` | `false` | Dry-run gate — `deploy` makes NO changes until `true` |
| `tang_backup_keys` | `true` | Real-world-only: back up escrow keys to the control node on every real deploy |
| `tang_key_backup_dir` | `~/.rhism/tang_key_backups` | Local control-node directory for the vault-encrypted backup |
| `tang_key_backup_vault_password_file` | *(none — required)* | Vault password file; role fails closed without it whenever a backup would happen |

**Digest vs. tag note**: `tang_image_tag` is only used to *pull* the image
(the `podman` role's `pull` action needs a human-readable tag). The running
container is always pinned to `tang_image_digest`, resolved via a real
`podman pull` against the official repository — never a floating tag, per
the platform's digest-pinning stance. Same precedent already established
for FreeIPA (`roles/podman/molecule/default/converge.yml`).

## Use Cases

**Standalone — deploy and verify (real target — needs a host with podman):**

```yaml
- hosts: tang_servers
  roles:
    - role: tang
      vars:
        action: deploy
        tang_deploy_execute: true   # the dry-run gate — off by default

- hosts: tang_servers
  roles:
    - role: tang
      vars:
        action: verify
```

**Real deployment with the control-node key backup (recommended for any
non-throwaway deployment):**

```yaml
- hosts: tang_servers
  roles:
    - role: tang
      vars:
        action: deploy
        tang_deploy_execute: true
        tang_backup_keys: true   # the default — shown for clarity
        tang_key_backup_vault_password_file: "{{ lookup('env', 'HOME') }}/.vault_pass"
```

**Custom port / non-default deployment:**

```yaml
- hosts: tang_servers
  roles:
    - role: tang
      vars:
        action: deploy
        tang_deploy_execute: true
        tang_port: 7500
```

## Testing

```bash
cd roles/tang && molecule test    # Tier 1 contract — no live podman target needed
```

**Discovered building this role**: `roles/podman` (which this role reuses
for all container mechanics) shells out to a real `podman` CLI binary via
the `containers.podman` collection — the EE itself has no such binary (it
only reaches the host's podman through the forwarded Docker-API-compatible
socket, via `community.docker`-family modules). `roles/podman`'s own
molecule scenario proves this by testing against a real nested-podman test
platform (`docker.io/geerlingguy/docker-rockylinux9-ansible`, privileged) —
this role deliberately does **not** replicate that heavy pattern. Instead:

- **Tier 1 (molecule `default`)**: argument-spec negative test, dispatch
  dispatch, and — the genuine contract assertion — proof that
  `tang_deploy_execute: false` (the default) makes **zero** changes (no
  pull, no container, no firewalld/SELinux).
- **Tier 3 (lab, not yet built)**: real image pull, real container, real
  clevis round-trip, and the vault-encrypted key backup, all against a
  genuine target host with podman. **Honestly not yet executed** — see
  `docs/rhism-alignment-plan.md`'s Phase C for the standing next step (the
  owner asked this be validated on the real test server, not built
  autonomously against it).

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | localhost (control host, Tier 1 contract) | Passing — argument spec, dispatch, dry-run-makes-no-changes (2026-07-16) |

### Bugfixes

- Discovered (not yet a numbered BUG — no functional defect, a design
  correction made before landing): the role's first draft assumed Tang
  could be functionally tested the same way `aap_config_as_code` tests
  pure-data logic (`hosts: localhost`) — `roles/podman`'s dependency on a
  real `podman` CLI binary (see Testing above) meant that would only ever
  fail in CI. Caught before merge by actually running the scenario, not by
  inspection — added the `tang_deploy_execute` dry-run gate and restructured
  to Tier 1 + a documented Tier 3 lab gap instead.

## Support / License

Supports EL 9 (the official image's own platform). MIT.

## Related Information

- Depth doc: [`docs/tang.md`](../../docs/tang.md) — internals, the
  digest-pin/precedent rationale, the client-binding and key-rotation gaps.
- `docs/rhism-alignment-plan.md` — the rhism alignment this role is Phase C
  item 1 of.
- `roles/podman` — the mechanics this role reuses (never reimplements).
