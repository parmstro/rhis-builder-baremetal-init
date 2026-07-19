# tang — depth doc

## What it automates

A Tang server is a stateless-from-the-network's-point-of-view key-escrow
service for NBDE (Network-Bound Disk Encryption): a LUKS-encrypted host,
bound to a Tang server via `clevis luks bind`, can unlock its own disks
automatically at boot **as long as it can reach the Tang server on the
network** — no human types a passphrase. Lose network reachability to every
bound Tang server and the host falls back to requiring a manual passphrase
(NBDE's actual security property: encryption keys are only ever escrowed to
a location the *legitimate network* controls, not stored on the disk or
typed by a person).

This role deploys the **server side only**: a running Tang instance serving
key material over HTTP on a chosen port, backed by a persistent key volume.

## Why the official image, not a build

`registry.redhat.io/rhel9/tang` is Red Hat's own published Tang image.
Per the platform's reputable-sources rule ("prefer the official published
artifact over re-derived machinery where one exists and passes the trust
pipeline"), this role pulls and digest-pins that image rather than building
a `ubiN-secure`-based Tang image from scratch — identical posture to how
`quay.io/freeipa/freeipa-server` is consumed for FreeIPA. No `FPS.md` /
all-three-bases build matrix applies here (that's for images this platform
*builds*); a consumed official image gets scan-only registration in
`playbooks/vars/platform_images.yml` instead.

The digest currently pinned (`sha256:6e94ae19a27caeba726e46a2124a396fc1f7d6c5f4f55ca11fe75e24e232deda`)
was resolved via a real `podman pull registry.redhat.io/rhel9/tang:latest`
on 2026-07-16 — re-pin deliberately (per the container-security stance: a
tag is a moving target, a digest move is a reviewed act) when a newer Tang
release is needed.

## Architecture

```
deploy (gated by tang_deploy_execute, default false — dry-run):
  roles/podman (pull)      → registry.redhat.io/rhel9/tang:{{ tag }}
  firewalld                → open tang_port/tcp (toggle: tang_manage_firewall)
  SELinux (seport)         → tangd_port_t on tang_port (toggle: tang_manage_selinux)
  roles/podman (container) → run at the DIGEST-pinned reference, named
                              volume {{ tang_volume_name }}:/var/db/tang
  backup_keys (toggle: tang_backup_keys, real deploys only) → see below

verify:
  package: clevis
  clevis encrypt tang '{"url": tang_verify_url}' -y | clevis decrypt
  assert output == input  (real round-trip, not a TCP-connect smoke test)
```

## Why deploy is dry-run gated

Discovered building this role, not assumed in advance: `roles/podman`
(reused here for all container mechanics) calls `containers.podman`
collection modules, which shell out to a **real `podman` CLI binary** on
whatever host the tasks run against. The EE that drives this platform's
testing does **not** have that binary — it only reaches the *host's* podman
through a forwarded, Docker-API-compatible socket, consumed via
`community.docker`-family modules elsewhere in this platform (the same
reason `bin/docker-shim.py` exists for `community.docker`). `roles/podman`'s
own molecule scenario proves its mechanics work by testing against a real
nested-podman platform (`docker.io/geerlingguy/docker-rockylinux9-ansible`,
privileged, `/sys/fs/cgroup` mounted) — a legitimate but heavy pattern,
appropriate for testing `roles/podman` itself.

`tang_deploy_execute` (default `false`) keeps this role's own CI scenario
side-effect-free without needing that heavy nested-podman platform: with the
gate off, `deploy` validates its argument contract and dispatch, then stops
— no pull, no container, no firewalld/SELinux change. Real functional
deployment (`tang_deploy_execute: true`) needs a genuine target host with
podman already available — a Tier-3 lab concern, not CI.

## Real-world key-material resilience (owner ask 2026-07-16)

A single Tang server is a **network-reachability single point of failure**
for every host bound to it: if its key volume is ever lost (container
destroyed, volume corrupted, host decommissioned) with no other copy, every
bound host permanently loses its automatic-unlock path (falling back to a
manual passphrase only if one was ever set and remembered — otherwise the
host's data can become unrecoverable).

When `tang_backup_keys` is `true` (the default) on a **real** deploy
(`tang_deploy_execute: true`), `deploy` finishes by:
1. Exec'ing into the running Tang container (`containers.podman.podman_container_exec`
   — the one place this role calls a `containers.podman` module directly
   rather than through `roles/podman`, since fetching file content isn't a
   lifecycle action that role exposes) to list and read every `*.jwk` key
   file under `/var/db/tang`.
2. Writing them to a local file on the **control node** (the machine
   running the build — never left as the Tang server's problem alone),
   under `tang_key_backup_dir` (default `~/.rhism/tang_key_backups`,
   deliberately outside this repo — control-node state, not platform
   content), with a timestamped filename (never overwritten).
3. **Vault-encrypting it immediately** via `ansible-vault encrypt
   --vault-password-file={{ tang_key_backup_vault_password_file }}`.

**Fails closed**: `tang_key_backup_vault_password_file` has no default. If
`tang_backup_keys` is true and no vault password file is configured, the
role refuses to fetch key material at all rather than ever writing it to
disk unencrypted — same posture as the platform's existing secrets-contract
discipline (e.g. AAP CaC's unfulfilled-secret refusal).

This is explicitly a **real-world-only** capability — never exercised in
molecule/CI (see Testing below), and not yet executed against a real target
at all (honest gap, tracked as TANG-FR-005 in `REQUIREMENTS.yml`).

## Deliberate scope boundaries

- **Client-side LUKS/clevis binding is not this role's job.** Binding a
  disk to a Tang server (`clevis luks bind`, `dracut --regenerate-all`,
  and the `sss` threshold-binding pattern for multiple Tang servers) is a
  host-provisioning/kickstart-time concern — it belongs with whatever does
  bare-host provisioning (rhism Phase C item 2), not the server role.
- **Key rotation is an honest, undone gap.** Tang's own upstream project
  documents a rotation procedure (generate a new `.tmp`-suffixed key so it
  isn't advertised yet, let it propagate, promote it, eventually retire the
  old key) — this role does not automate it, and neither does upstream
  RHIS. Tracked as a real backlog item, not silently assumed away.
- **No multi-server / threshold (`sss`) topology wiring.** This role stands
  up one Tang instance; a resilient NBDE deployment typically runs several
  and binds clients with a threshold policy across them (the client-side
  concern noted above). Multiple `tang` role invocations against different
  hosts already compose toward this — no special multi-instance logic is
  needed in the role itself.

## Testing

Tier 2 (functional, `docs/testing-efficacy.md`): the molecule `default`
scenario pulls the real image, runs a real sibling container via the EE's
podman socket, and drives two full clevis round-trips (before and after a
re-deploy) to prove both FR-001/002 (it works) and FR-003 (a re-deploy
doesn't lose escrowed keys — the persisted named volume survives container
recreation). SELinux/firewalld management is disabled in the test scope
only (both are commonly unavailable in unprivileged test containers); both
run for real on any target that leaves the toggles at their `true` defaults.

## Related

- `docs/rhism-alignment-plan.md` — rhism alignment Phase C, item 1.
- `roles/podman` — the container mechanics this role composes, never
  reimplements (CLAUDE.md "Reuse existing roles").
- `roles/podman/molecule/default/converge.yml` — the FreeIPA pull+digest-pin
  precedent this role follows structurally.
