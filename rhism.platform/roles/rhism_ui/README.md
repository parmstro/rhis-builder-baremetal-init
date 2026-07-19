# rhism_ui

## Description

Security-hardened fork of RHIS's **rhis-builder-ui** — a Node.js/Express +
React web application for browsing the SOE (Standard Operating Environment)
catalog and building an estate deployment session (site parameters, component
counts/versions, SOE selections), then exporting an `inventory_basevars.yml` +
`soe_selections.yml` pair consumable by the rest of the RHIS/rhism tooling.
This role builds the REAL, already-fixed application (`files/rhism_ui/`,
collection commit `faf40d7`) from source via a real `podman build`, and runs
it — no vendored/unpatched image, no manual container invocation.

**Complements, does not replace, `rhism.platform.wizard`** — this platform's
existing interactive TUI already does the identical job (build an estate
deployment manifest). `rhism_ui` is a **web-based alternative interaction
surface** for the same underlying data shape, not a second, competing
orchestrator — the guiding principle is one wizard, one builder, one estate
manifest, so `rhism_ui` produces/consumes manifest-shaped data; it does not
deploy anything itself.
See `docs/rhism-ui.md` (orchestration repo) for the full comparison.

**Four real security fixes were applied to the forked source before this role
was built around it** (see the source files themselves for the fix
commentary):

1. **Real authentication** (`files/rhism_ui/backend/src/auth.js`) —
   `POST /api/session/claim` (first claim) and `POST /api/session/steal`
   (always) now require a shared secret via the `X-Admin-Secret` header,
   checked with `crypto.timingSafeEqual`. The original app had no credential
   anywhere on these endpoints.
2. **Restricted CORS** (`files/rhism_ui/backend/src/app.js`) — CORS is
   disabled by default; `RHISM_UI_ALLOWED_ORIGIN` opts in a specific origin
   for local dev only. The original set `Access-Control-Allow-Origin: *`
   unconditionally.
3. **Path-traversal guards** (`files/rhism_ui/backend/src/utils.js`,
   consumed by `routes/deployment.js`, `routes/deployments.js`,
   `routes/catalog.js`) — `assertSafeSegment`/`assertWithinBase` reject any
   `domain`/catalog-id value containing `..`, `/`, or `\`, and independently
   confirm the resolved path stays inside the intended base directory. The
   original did an unsanitized `path.join()`.
4. **Loopback-only bind** (`files/rhism_ui/backend/src/index.js`) — the app
   binds `127.0.0.1` by default; the containerized case needs `HOST=0.0.0.0`
   *inside its own network namespace* (podman's port-forwarding delivers
   traffic to the container's internal interface, not its loopback) — the
   real host-reachability boundary is podman's own `-p 127.0.0.1:...`
   publish, which this role always sets (see `tasks/install.yml`).

The Containerfile also carries a build fix (`--chown=1001:0` on every `COPY`)
— the vendored original does not build at all under any standard non-root
build (Docker, Podman, OpenShift BuildConfig, CI), see
`roles/rhism/rhis-builder-ui-main/SECURITY-REVIEW.md` in the orchestration
repo for the full original finding.

## Requirements

- A host with `podman` available (this role reuses `roles/podman` for all
  container mechanics — no direct `containers.podman` calls of its own; see
  **Testing** below for the BUG-160 discovery this implies).
- Network access during the build (npm install for both `backend/` and
  `frontend/`) — no network needed once the image is built and the container
  is running.
- A real `rhis-builder-inventory` checkout to point `rhism_ui_catalog_path`
  at (see `roles/rhism/rhis-builder-inventory-heads-main/schema/` in the
  orchestration repo for an example layout).

## Role Variables

| Variable | Default | Description |
|---|---|---|
| `rhism_ui_action` | `install` | `install`, `configure` (no-op), `status` |
| `rhism_ui_build_context` | `{{ role_path }}/files/rhism_ui` | Source tree + Containerfile this role builds from |
| `rhism_ui_image_repository` | `localhost/rhism-ui` | Locally-built image repository (never pulled) |
| `rhism_ui_image_tag` | `latest` | Tag applied to the locally-built image |
| `rhism_ui_image_digest` | *(empty)* | Reserved for a future registry-push/re-pull path; unused for the local build today |
| `rhism_ui_container_name` | `rhism-ui` | Container name |
| `rhism_ui_port` | `3001` | TCP port (host and container) — matches the app's own default |
| `rhism_ui_data_volume_name` | `rhism-ui-data` | Named volume persisting the session-lock SQLite DB |
| `rhism_ui_container_data_dir` | `/app/backend/data` | In-container mount point for the data volume |
| `rhism_ui_admin_secret` | *(none — required)* | Shared secret for session claim/steal (`no_log: true`) |
| `rhism_ui_allowed_origin` | *(empty = CORS disabled)* | CORS allowed origin for local dev |
| `rhism_ui_catalog_path` | *(none — required)* | Host path mounted read-only at `/catalog` |
| `rhism_ui_deployment_path` | *(empty = optional)* | Host path mounted read-write at `/deployments` |
| `rhism_ui_deploy_execute` | `false` | Dry-run gate — `install`/`status` make NO changes until `true` |
| `rhism_ui_base_url` | `http://127.0.0.1:{{ rhism_ui_port }}` | Base URL `status`'s health check calls |
| `rhism_ui_sizing` | `s` | Capacity-planning tier — see below |

### Capacity planning (t-shirt sizing)

Additive figures — the shared OS baseline (1 vCPU / 2 GB / 20 GB, RHEL 9) is
excluded; see `docs/capacity-planning.md`. No vendor guidance exists for this
bespoke Node.js/SQLite app (unlike nagios/splunk/elastic's vendor-published
tables) — figures are this platform's own measured/estimated sizing, keyed
by catalog size and operator cycle volume, labeled honestly per
`capacity-planning.md`'s own rule for the no-vendor-guidance case.

| Tier (`rhism_ui_sizing`) | Scale | CPU | RAM | Disk |
|---|---|---|---|---|
| `s` (default) | Small catalog, occasional use | 1 | 512 MB | 1 GB |
| `m` | Larger catalog, regular use | 2 | 1 GB | 5 GB |
| `l` | Large catalog, frequent operator cycles | 2 | 2 GB | 20 GB |

## Use Cases

**Standalone — install and check status (real target — needs a host with podman):**

```yaml
- hosts: rhism_ui_servers
  roles:
    - role: rhism.platform.rhism_ui
      vars:
        rhism_ui_action: install
        rhism_ui_deploy_execute: true   # the dry-run gate — off by default
        rhism_ui_admin_secret: "{{ vault_rhism_ui_admin_secret }}"
        rhism_ui_catalog_path: /home/ansiblerunner/rhis/rhis-builder-inventory/schema/soe_catalog

- hosts: rhism_ui_servers
  roles:
    - role: rhism.platform.rhism_ui
      vars:
        rhism_ui_action: status
        rhism_ui_deploy_execute: true
```

**Real deployment with server-side export (DEPLOYMENT_PATH):**

```yaml
- hosts: rhism_ui_servers
  roles:
    - role: rhism.platform.rhism_ui
      vars:
        rhism_ui_action: install
        rhism_ui_deploy_execute: true
        rhism_ui_admin_secret: "{{ vault_rhism_ui_admin_secret }}"
        rhism_ui_catalog_path: /home/ansiblerunner/rhis/rhis-builder-inventory/schema/soe_catalog
        rhism_ui_deployment_path: /home/ansiblerunner/rhis/deployments
```

## Testing

```bash
cd collections/rhism/platform/roles/rhism_ui && molecule test    # Tier 2 REAL functional
```

**Discovered building this role**: `roles/podman` (which this role reuses for
all container mechanics) shells out to a real `podman` CLI binary via the
`containers.podman` collection — the EE itself has no such binary (BUG-160,
first discovered building `roles/tang`). Unlike `roles/tang`/`roles/quay`
(which stay Tier-1-only, deferring real proof to a Tier-3 lab), this role's
own molecule scenario exercises the **real path in CI**: a self-contained
Node app with no external infra dependency beyond podman itself makes a
genuine Tier-2 functional test practical, using the same heavy nested-podman
test platform `roles/podman`'s own scenario uses
(`docker.io/geerlingguy/docker-rockylinux9-ansible`, privileged).

- **Tier 2 (molecule `default`)**: builds the real image from
  `files/rhism_ui/`'s Containerfile, runs the real container, and
  `verify.yml` re-proves — with real `ansible.builtin.uri`/`stat`/`command`
  calls against the genuinely running container — every one of the 8
  behaviors from the manual pre-flight verification (unauthenticated
  claim/steal rejection, authenticated claim, wrong-secret rejection,
  reconnect without re-presenting the secret, no CORS header, the
  path-traversal export rejection with no file written, and a real
  `/healthz` liveness check), plus two bonus real checks (loopback-only
  publish binding, and a real `status` action call against the live
  instance). Also covers the standard argument-spec negative test, a
  dispatch-file-exists proof, and a genuine (not tautological — real podman
  is installed on the test host) proof that `rhism_ui_deploy_execute:
  false` makes zero changes.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | nested podman (`docker.io/geerlingguy/docker-rockylinux9-ansible`, privileged, Tier 2 real functional) | Passing — see this role's molecule run log (2026-07-16) |

### Bugfixes

- No new BUG-NNN — this role's own discovery matches the already-recorded
  BUG-160 pattern exactly (a role reusing `roles/podman` needs either the
  heavy nested-podman test pattern or a dry-run-only Tier-1 gate); this role
  is the first to take the nested-podman option for a genuine Tier-2
  functional proof rather than deferring to Tier-3.

## Support / License

Supports EL 9 hosts with podman. MIT.

## Related Information

- Depth doc: [`docs/rhism-ui.md`](../../../../../docs/rhism-ui.md)
  (orchestration repo) — fork rationale, all 4 fixes cited by file:line, the
  post-fix container security re-scan result, and the relationship to
  `rhism.platform.wizard`.
- `roles/rhism/rhis-builder-ui-main/SECURITY-REVIEW.md` (orchestration repo)
  — the original Tier-3 ad-hoc review this fork's fixes were derived from.
- `docs/rhism-alignment-plan.md` (orchestration repo) — the rhism alignment
  this role is part of.
- `roles/podman` (orchestration repo) — the mechanics this role reuses
  (resolved via `ANSIBLE_ROLES_PATH`, never reimplemented).
