# rhis-builder-ui — Tier-3 security review (2026-07-16)

Owner ask: put this vendored graphical UI through this platform's full container
security rigor before any real use. This document is a review NOTE about the
vendored snapshot. **Update (2026-07-16, same session)**: the `--chown=1001:0`
build fix below was, on explicit owner instruction, applied directly to the
vendored `Containerfile` in place (with a header comment attributing the
change and pointing back to this document) — this review's build/scan
findings were gathered against a scratch-only copy BEFORE that patch landed,
but the fix is now the same one committed for real. `backend/`/`frontend/`
source remain untouched — only the Containerfile's `COPY` instructions were
patched. Findings here are what needs fixing (in this platform's own
fork/role, if/when one gets built) before this UI is exposed to any real
network or given real deployment-directory access.

**Scope**: build + static/dependency scan only. The actual `node
backend/src/index.js` service was never launched; no port was exposed; no
inventory/deployment data was mounted. Any real run of this UI stays a Tier-3,
owner-executed concern, same as every other real deployment this session.

## Base image

`registry.access.redhat.com/ubi9/nodejs-22:latest` — a public, official Red
Hat UBI image (no entitlement required). Resolved via
`podman manifest inspect` on 2026-07-16:

| Arch | Digest |
|---|---|
| amd64 | `sha256:14feec969e115d7fc6c9f6526873962c28adc63b802f9a1eb4a879c1a001e5ef` |
| arm64 | `sha256:4bbaf917c1542bf6d94aad09bf8de8ff9a04c0419c39f68005c1021c03cbc0a5` |

Use the amd64 digest for any real (production-target) pin — this platform's
own build host is arm64/Apple Silicon via Podman Machine, but real
deployments target amd64 RHEL/OCP hosts.

## Build finding — the vendored Containerfile does not build as shipped

`podman build .` against the vendored `Containerfile` fails outright:

```
npm error code EACCES
npm error syscall mkdir
npm error path /app/frontend/node_modules
```

Root cause: `registry.access.redhat.com/ubi9/nodejs-22` defaults to a
non-root user (`uid=1001 gid=0`, confirmed via `podman run ... id`).
`WORKDIR /app/frontend` creates that directory as root during the build;
`COPY frontend/package*.json ./` (no `--chown`) leaves it root-owned; the
subsequent `RUN npm ci` executes as uid 1001 and cannot write into it. This
is not a rootless-podman-specific quirk — any standard non-root build
(Docker, OpenShift BuildConfig, CI) hits the identical failure, since the
base image's non-root default is unconditional. **The Containerfile as
shipped cannot be built by anyone without first patching it.**

Verified fix (applied only to a scratch-only copy at `/tmp/rhis-ui-scan-only`
outside this repo, purely to get real scan data — the vendored copy in this
directory is untouched): add `--chown=1001:0` to every `COPY` instruction.
With that fix, the build succeeds cleanly (see `npm ci`/`npm run build`
output — 0 vulnerabilities reported at build time, consistent with the
`npm audit` results below).

## Source-level review

**`backend/package.json`** dependencies: `better-sqlite3 ^11.0.0`,
`cors ^2.8.5`, `express ^4.19.2`, `js-yaml ^4.1.0`. Small, current, no
obviously stale or suspicious packages.

**`frontend/package.json`** dependencies: `@patternfly/react-core`/`-icons
^5.4.0`, `react`/`react-dom ^18.3.1`; dev-only: `vite ^5.4.0`,
`@vitejs/plugin-react`, `@vitejs/plugin-basic-ssl`. Also small and current.

**`js-yaml` usage** (`backend/src/utils.js` `fromYaml()`): calls
`yaml.load()`, not a custom-schema/unsafe loader. js-yaml v4's `load()` is
safe-by-default (v4 removed the v3 `load`-vs-`safeLoad` split) — checked, not
a vulnerability.

**CRITICAL — no real authentication, by design.**
`backend/src/session-lock.js` + `backend/src/routes/session.js` implement a
single-operator *concurrency lock*, not access control:
- `POST /api/session/claim` (`session.js:14`) is public — the first caller
  to hit it gets a session token. No credential of any kind.
- `POST /api/session/steal` (`session.js:51`) is **also fully public, with
  zero validation** — any caller can immediately seize the session AND wipe
  all deployment session data (`clearSession()`), with nothing but a bare
  POST request. There is no username, password, or token check anywhere in
  this file.
- `app.js:31-38`'s `requireSession` middleware only checks that
  `x-session-token` matches whatever token is *currently* live — it does not
  establish who is allowed to hold that token in the first place. Anyone who
  calls `/claim` (or `/steal`) gets a fully valid session token instantly.

**This means the application has no real access-control boundary at all.**
It is built on a "single trusted operator on a private, already-secured
network" threat model — every `/api/*` route is reachable and actionable by
anyone with network reachability to the service.

**Compounding factor — wide-open CORS.** `backend/src/app.js:17`:
`app.use(cors());` with no options, which sets
`Access-Control-Allow-Origin: *` for every response. Combined with
`/api/session/steal` taking **no parameters and no token**, this is a
drive-by CSRF-class issue: any webpage a victim's browser merely loads,
while that browser has network reachability to a running rhis-builder-ui
instance, can silently `fetch('http://<host>:8080/api/session/steal',
{method:'POST'})` and wipe all deployment session data — no cookie, no
credential, no user interaction with the malicious page beyond loading it.

**HIGH — path traversal / arbitrary file write via the `domain` value.**
- `backend/src/routes/deployment.js:77-80`: `POST /api/deployment/export`
  takes `domain = site.basevars_global_domain_name` — a value the client
  sets earlier via `PUT /api/deployment/site` with **zero format
  validation** — and does `join(DEPLOYMENT_PATH, domain)`, then writes
  `inventory_basevars.yml`/`soe_selections.yml`/`ui_session.yml` into that
  path. `path.join()` does not sanitize `../` segments. A `domain` value
  like `../../../../etc/cron.d` (or any path escaping `DEPLOYMENT_PATH`)
  lets a session holder write files to an **arbitrary filesystem location**
  the container process can reach — not merely read data cross-tenant, but
  write it.
- `backend/src/routes/deployments.js:32-37`: `GET /api/deployments/:domain`
  does the identical unsanitized `join(DEPLOYMENT_PATH, domain)` for a
  **read** (`ui_session.yml`/`soe_selections.yml`) — the read-side
  counterpart of the same traversal class.
- **Given the CRITICAL finding above (no real auth), "requires a session
  token" is not a meaningful mitigation** — any network-reachable caller can
  get a token trivially via `/claim` or `/steal`.

**LOWER SEVERITY — path traversal (read-only, narrower blast radius).**
`backend/src/routes/catalog.js:50`: `GET /api/catalog/:id` does
`join(CATALOG_PATH, `${req.params.id}.yml`)`, also unsanitized. Lower
severity than the above: `CATALOG_PATH` is mounted **read-only**
(`run_container.sh`'s `-v "$inventorydir":/inventory:ro,Z`) and Express's
default `:id` capture excludes literal `/` (traversal would need URL-encoded
`%2F` sequences to have any chance of working, unverified either way here) —
still worth fixing (an explicit allowlist/basename check), just not as
urgent as the write-side finding above.

## Dependency scan (`npm audit`, real data, 2026-07-16)

**Backend** (`--omit=dev`, i.e. the production dependency tree that
actually ships in the image): **0 vulnerabilities**.

**Frontend**: 2 vulnerabilities (1 moderate, 1 high) — `esbuild <=0.24.2`
(pulled in by `vite <=6.4.2`, both **devDependencies**):
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) —
"esbuild enables any website to send any requests to the development server
and read the response." **This is a dev-server-only vulnerability.** The
Containerfile only runs `npm run build` (a static production bundle via
Vite's build, not the dev server) — the vulnerable component is not present
in the runtime image. Real but low-priority: fix via `npm audit fix --force`
(a breaking Vite major-version bump) at a convenient time, not urgent for
runtime security.

## Container image scan (Trivy, via `roles/container_security`)

Ran `container_security_action: pipeline` (scan + SBOM + assess, CMDB
disabled, treat/rebuild/verify disabled — this is a one-time ad-hoc review,
not a standing pipeline entry) against
`localhost/rhis-builder-ui-security-review:latest` (the scratch-patched
build). Raw Trivy output: `output/rhis-builder-ui-security-scan-artefacts/
trivy_localhost_rhis-builder-ui-security-review_latest.json` (gitignored
scratch, not committed).

**85 findings, all HIGH severity, 0 CRITICAL, 0 with an available fix**
(Red Hat has not yet shipped a backport for any of them as of 2026-07-16 —
this is the current, honest CVE posture of the `ubi9/nodejs-22:latest` tag
itself, not something the application code introduced):

| Package | CVE count | Relevance to this app |
|---|---|---|
| `kernel-headers` | 42 | Metadata-only header package; the container shares the **host** kernel and never runs its own — effectively inert here |
| `curl-minimal` / `libcurl-minimal` | 6 + 6 | OS utility; not in this app's own dependency chain (Node's `fetch`/`express` don't shell out to curl) |
| `nodejs` / `nodejs-docs` / `nodejs-full-i18n` / `nodejs-libs` / `npm` | 3+3+3+3+3 | **The actual Node.js runtime this app executes on — genuinely relevant**, worth re-checking once Red Hat ships a fix |
| `vim-filesystem` / `vim-minimal` | 3 + 3 | Editor bundled in the base image; never invoked by this app |
| `tar` | 2 | OS utility, not used by the app directly |
| `python3` / `python3-libs` | 1 + 1 | Base-image tooling (used by `npm` native module builds at image-build time, e.g. `better-sqlite3`'s node-gyp step); not present in the app's own runtime code path |
| `acl` / `libacl` / `glib2` / `openssh` / `openssh-clients` / `nodejs-nodemon` | 1 each | Base-image bloat, none invoked by this app (`nodemon` is a dev-only tool, not used by the production `CMD`) |

**Read honestly**: this is standard UBI9 base-image posture, not a defect in
the vendored application — the only genuinely relevant row is the Node.js
runtime itself (12 CVEs across the `nodejs*`/`npm` packages), and none have
a fix available yet. Re-scan whenever this platform actually builds its own
trusted fork, and again immediately before any real deployment, since
Red Hat regularly backports fixes to UBI errata.

## Before this UI is actually run/used — checklist

1. **Add real authentication in front of every `/api/*` route** (not just
   the session-lock concurrency guard) — a reverse proxy with OIDC/basic
   auth, or genuine credential-checked login, before this is ever exposed
   beyond a fully air-gapped, single-operator, already-trusted context.
2. **Restrict CORS** to an explicit allowed origin (or drop it entirely if
   the UI is always same-origin in practice) — `cors()` with no options is
   not acceptable for anything network-reachable.
3. **Sanitize `domain`/path-segment values** in `deployment.js` (export) and
   `deployments.js` (`:domain`) — resolve the joined path and assert it
   stays within `DEPLOYMENT_PATH` (e.g. compare real/resolved paths, or
   restrict `domain` to a safe charset with no `.`/`/`) before any
   read/write. Apply the same fix to `catalog.js`'s `:id` param.
4. **Patch the Containerfile** with `--chown=1001:0` on every `COPY`
   instruction (verified fix, see Build finding above) before this platform
   builds its own trusted copy — the vendored source cannot be built
   as-is.
5. **Digest-pin** `registry.access.redhat.com/ubi9/nodejs-22` to the amd64
   digest above once this platform builds its own fork.
6. Re-run `npm audit fix` on the frontend once convenient (low priority,
   dev-only vulnerability, not blocking).
7. **Phase 0 classification** (not done here, out of scope for this
   review): decide whether this becomes a proper platform role
   (`roles/rhism_builder_ui` or similar) per the role-definition doctrine,
   once 1-3 above are actually fixed in a real fork — tracked in
   `docs/project-backlog.md`.

**Bottom line**: do not expose this UI, or give it real
`DEPLOYMENT_PATH`/inventory access, until findings 1-3 are fixed. The
combination of no real authentication + open CORS + unauthenticated
`/steal` + unsanitized path joins means this is not safe on any network
beyond a fully isolated, single-operator context as currently written.
