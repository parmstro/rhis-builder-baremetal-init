# satellite — role depth doc

Internals, workflow, and operational notes for the `satellite` role. See the role `README.md`
for the quick-start and variable table; this doc is for people using or maintaining the role
in depth.

## What it manages

[Red Hat Satellite](https://www.redhat.com/en/technologies/management/satellite) — the Red Hat
subscription lifecycle and content management platform (Foreman plus RHSM). The role registers
the host with RHSM, installs Satellite via `satellite-installer`, uploads the subscription
manifest, and drives the API through the `theforeman.foreman` collection (organizations, CDN
repository sets, products/repositories, sync plans, content views, activation keys, smart
proxies, compute resources).

## Where it sits

`satellite` is one of the **content-management** product roles selected by the
`content_management` dispatcher (`content_type`): `foreman`, `satellite`. A site uses exactly
one. Satellite is the Red Hat subscription choice — everything `foreman` does, plus RHSM
registration, manifest upload, and Red Hat CDN repository sets (the extra `cdn_repos` action
and `content_rhsm_*` vars).

### Shared variable interface ("sameness")

Both products consume the **same** variable names, so the dispatcher selects either with one
identical call and no per-product code. See [`docs/content-management.md`](content-management.md)
for the shared-interface table. The role ships defaults for all of these (`defaults/main.yml`)
so it runs standalone, and declares the interface in `meta/argument_specs.yml` (ansible-core
validates it at role entry — there is no manual `assert`).

## Selection & call flow

```
content_management (content_action: install, content_type: satellite)
        │  include_role name={{ content_type }}   vars: {action: install}
        ▼
satellite ── argument_spec validation ── action=install, content_install_execute ──► install / dry-run
        ▲
   standalone playbook  roles: [satellite]  vars: {action: install}  ─────────────────┘
        (same role, same vars, no dispatcher required)
```

## Actions

`main.yml` dispatches with a `when: action == '...'` chain (the argument spec validates the
action). Actions fall into three groups:

- **Package lifecycle** — `present` / `absent` (share `packages.yml`, `state: {{ action }}`).
- **Service lifecycle** — `started` / `stopped` / `restarted` (share `services.yml`, manages
  `foreman` + `postgresql`).
- **Install + API** — `install` (RHSM + installer + manifest), `configure`, **`cdn_repos`**
  (Satellite-only), `repos`, `sync`, `content_views`, `activation_keys`, `lifecycle`,
  `smart_proxy`, `compute_resource`, **`host`**, **`export_content`**, **`transfer_media`**,
  **`import_content`**, **`soe_bundles`**, `status`.

The API actions are **list-guarded**: each is `when: <content_*> | length > 0`, so with the
empty defaults they run zero modules (a true no-op). This is what lets molecule exercise them
without a subscription or live server.

## Install workflow (`action: install`)

1. **RHSM register** — `community.general.redhat_subscription` with `content_rhsm_org_id` /
   `content_rhsm_activation_key` (skipped when `content_rhsm_skip_registration` is true).
2. **Enable Satellite repos** via `subscription-manager repos --enable …`.
3. **Upload manifest** — copy `content_rhsm_manifest_path` to `/root/manifest.zip`
   (when set and `content_install_execute` is true).
4. Install `satellite` / `satellite-installer` / `satellite-cli` packages; open the firewall
   (`_firewall.yml`).
5. **Install gate** — if `content_install_execute` is `false` (default), print the
   `satellite-installer --scenario satellite …` command as a dry-run; if `true`, run it, notify
   the restart handler, then `hammer subscription upload` the manifest.

## CDN repository sets (`action: cdn_repos`)

Satellite-only: `theforeman.foreman.repository_set` enables Red Hat CDN-backed repos by product
and set name from `content_cdn_repository_sets` (requires an active RHSM subscription). Foreman
has no equivalent.

## Bare-host provisioning (`action: host`) — rhism alignment Phase C item 2

The role's newest capability (2026-07-16): creating a host record in
Satellite and putting it into a real PXE-build state, in one declarative
call, matching what a Foreman/Satellite admin does by hand through the web
UI (Hosts → Create Host) or via `hammer host create` — the API underneath
is the same either way.

**Double-gated, unlike this role's other list-guarded actions.** Every
other list-guarded API action (`content_views`, `activation_keys`, `repos`,
...) treats a non-empty list as sufficient authorization to act — populate
the list, the role does it. `host` deliberately does NOT follow that
pattern: `content_hosts` being non-empty is necessary but not sufficient —
`content_host_execute` (default `false`) must ALSO be `true` before
`theforeman.foreman.host`/`host_power` are ever called. Found worth adding
in a post-build review (2026-07-16): this action creates a real host record
AND can trigger a real reboot-into-PXE-installer, materially more
consequential than adding a content view or a sync plan — the same
double-gate carefulness this platform applies to `roles/convert2rhel`'s
execute+confirm gates. With `content_host_execute: false` (the default),
the role reports what it WOULD do via a `debug` task and makes zero API
calls — safe to populate `content_hosts` for review/planning without any
risk of accidentally creating or power-cycling a real host.

**The mechanics, end to end:**

1. **`theforeman.foreman.host`** creates (or removes) each entry in
   `content_hosts`, looped. The module talks to Foreman's `/api/v2/hosts`
   endpoint. Key fields and what they actually mean server-side:
   - `hostgroup` — a *template*. Satellite resolves the new host's
     organization, location, content view, lifecycle environment,
     activation key(s), domain, subnet, realm, architecture, operating
     system, partition table, and PXE loader from whichever hostgroup you
     name — you are not setting those individually per host in the common
     case, the hostgroup already carries them (see `hostgroups.yml`-style
     definitions this platform's own `content_views`/`activation_keys`/
     `lifecycle` actions already produce).
   - `compute_resource` — which hypervisor/cloud backend actually
     provisions compute for this host (`baremetal` is a special
     pseudo-resource meaning "this is real hardware, Satellite is only
     tracking it, not creating a VM").
   - `interfaces_attributes` — one entry per NIC. `mac` + `ip` + `subnet`
     is what lets Satellite's DHCP/DNS/TFTP smart proxies actually respond
     to this specific machine's PXE request with the right boot files —
     without a correct MAC here, the real network boot never associates
     with this host record at all, regardless of how correctly everything
     else is configured.
   - `build: true` — this is the flag that actually matters for PXE: it
     tells Satellite "the next time this host network-boots, serve it the
     install (not local-disk-boot) PXE menu entry." Satellite computes the
     actual TFTP/kickstart file paths from the hostgroup's operating
     system + PXE loader + partition table at this point.
2. **`theforeman.foreman.host_power`** (only when an entry sets
   `power_cycle: true`, and only for hosts being created — not removed)
   issues a `reset` against Satellite's own BMC/hypervisor power-management
   integration for that host's compute resource. This is what actually
   causes the physical or virtual machine to reboot and, because `build`
   was just set, boot into the PXE installer instead of its normal OS.
3. **What this role deliberately does NOT do**: wait for the kickstart to
   actually complete. Real install time varies enormously by hardware
   (minutes to well over an hour for bare metal with slow storage/network),
   and Satellite's own signal for "done" (the host checking in post-install
   via `subscription-manager`/Puppet/whatever the hostgroup configures) is
   itself asynchronous and not something this role's synchronous task model
   is a good fit for polling. Confirming a build actually finished is a
   Tier-3 lab / operator concern (check `hammer host status` or the
   Satellite UI's own "Build" progress after triggering).

**Two-path outcome** (owner ask 2026-07-16, `docs/rhism-alignment-plan.md`):
this is the *heavy* path — full Satellite content-lifecycle integration,
for estates that already run Satellite. `roles/cobbler`'s `add_systems`
action is the parallel *light* path (PXE/DHCP/TFTP only, no Satellite or
Foreman dependency at all) for the same underlying outcome — an estate
picks whichever it already runs, or neither.

## Disconnected content transfer (`export_content` / `transfer_media` / `import_content`) — rhism alignment Phase C item 3

Three independently-callable stages replacing upstream RHIS's disconnected-network content
pipeline. The real gap they close: RHIS shipped this as 4 bash scripts, but only 2 of the 4
actually contained real logic reachable in the vendored tree — `configure_export.sh` was
host-level drive-prep (mount + SELinux/ownership on an export volume — deliberately **not**
automated here, same host-vs-role boundary as `roles/tang` not automating LUKS binding) and
`build_sat_disconnected_export.sh` plus its import-side sibling were both thin wrappers around
a playbook that isn't even present in the tree it ships from. That "playbook" is what these
three task files actually are — built against the real `theforeman.foreman.content_export_*` /
`content_import_*` modules, verified live against `ansible-doc` before use, not guessed from
the shell scripts' variable names.

**`export_content`** — dispatches per `content_exports` entry to one of three modules by
`type`, because Pulp exports at three different granularities that don't share one API call:
- `type: library` → `content_export_library` — the *entire* organization's content library,
  the widest possible export.
- `type: repository` → `content_export_repository` — one product+repository at a time.
- `type: version` → `content_export_version` — one specific content-view version, the
  granularity that actually matches what most disconnected estates want (a known-good,
  already-promoted set of content, not "everything" or "one repo in isolation").

All three write into `content_pulp_export_dir` (`/var/lib/pulp/exports` by Satellite's own
convention — not something the API call itself parameterizes, Satellite decides the path from
organization + destination_server). `incremental: true` + `from_history_id` chains a delta
export off a previous one instead of re-exporting everything, for repeat transfers to the same
disconnected side.

**`transfer_media`** — the only stage of the three with **no Satellite API call at all**. Pure
filesystem work: `ansible.posix.synchronize` copies `content_transfer_source_dir` onto
`content_transfer_media_path`, then every source file is independently re-`stat`'d with a
SHA256 checksum and compared against the same checksum taken at the destination — not trusting
`synchronize`'s own "it said success" return, because the entire point of this stage is that
physical transfer media (USB, removable disk) is exactly the kind of link that can silently
corrupt a byte and still report a clean copy at the filesystem-call level. **Fails closed**:
`content_transfer_media_path` has no default, so a bare `action: transfer_media` run refuses
to guess a destination for an air-gapped copy rather than silently picking one.

**`import_content`** — the receiving side, run on a disconnected Satellite. Dispatches by the
same `type` field, but unlike export, all three `content_import_*` modules take an *identical*
parameter set (`organization` + `path`, plus optional `metadata`/`metadata_file`) — Satellite
auto-detects what it's importing from the metadata written alongside the content at export
time, so `path` is really the only thing that matters per entry. `path` defaults to
`content_transfer_media_path`, so the three stages chain together with zero extra variables
when run in one play; an entry can still override `path` to import from anywhere else.

**Why this is a genuine air-gap, not just "three tasks in a row"**: nothing about
`transfer_media` requires the export and import Ansible runs to happen on hosts that can reach
each other, or even happen close together in time — the media itself is the only thing that
crosses the gap. `export_content` and `import_content` each independently need their own
`content_server_url`/credentials for whichever Satellite (connected or disconnected) they're
pointed at.

## SOE bundle model (`action: soe_bundles`) — rhism alignment plan reuse-map item 1

The role's newest capability (2026-07-16), and the one the `docs/rhism-alignment-plan.md`
review called "the strongest idea" carried over from upstream RHIS: a `soe_bundles:` composable
unit for a single OS build's content/kickstart/hostgroup spec, aggregated into this role's own
flat `content_*` lists. Where `host`/`export_content`/`transfer_media`/`import_content` each
closed a genuine mechanics gap (new API calls this role didn't make before), `soe_bundles`
closes a *usability* gap on mechanics the role already had: today, standing up one new OS
build's Satellite content posture means hand-authoring matching entries across
`content_lifecycle_environments`, `content_views`, `content_host_collections`, and
`content_activation_keys` — four lists, kept in sync by the human, not the role.

**One SOE bundle = one OS build's whole content posture.** Each `content_soe_bundles` entry:

| Field | Required | Default | Feeds |
|---|---|---|---|
| `name` | yes | — | SOE identifier; default basis for `content_view`/`activation_key` names |
| `lifecycle_environment` | yes | — | the lifecycle environment this SOE promotes into |
| `lifecycle_environment_prior` | no | `Library` | the environment immediately before it in the promotion path |
| `content_view` | no | `name` | content view name |
| `content_view_description` | no | — | content view description |
| `repositories` | no | — | repositories added to the content view |
| `activation_key` | no | `name` | activation key name |
| `auto_attach` | no | `true` | activation key auto-attach |
| `subscriptions` | no | — | subscriptions attached to the activation key |
| `host_collections` | no | — | list of `{name, description}` — created and attached to the activation key |
| `hostgroup` | no | — | **reference only** (see below) |
| `kickstart_snippet` | no | — | **reference only** (see below) |

**The transform — genuine reuse, not a parallel implementation.** `soe_bundles.yml` does not
call a single `theforeman.foreman` module directly. It:

1. Asserts every bundle carries at least `name` + `lifecycle_environment`.
2. Loops over `content_soe_bundles` and, per bundle, builds three derived facts using plain
   `combine()` (so an unset optional field is genuinely *absent* from the derived dict, not a
   null/empty value — the same "missing key → `default(omit)` at the module call" pattern
   `content_views.yml`/`activation_keys.yml` already rely on for their own flat lists):
   - `_soe_lifecycle_environments` — one `{name, prior}` entry per bundle, the exact shape
     `content_lifecycle_environments` already takes.
   - `_soe_content_views` — one `{name, description, repositories, lifecycle_environments}`
     entry per bundle, the exact shape `content_views` already takes (`lifecycle_environments`
     is a one-item list so `content_views.yml`'s existing `subelements`-based promote step
     handles it with no changes).
   - `_soe_activation_keys` — one `{name, lifecycle_environment, content_view, auto_attach,
     subscriptions, host_collections}` entry per bundle, the exact shape
     `content_activation_keys` already takes (`host_collections` here is the flat list of
     *names* the activation key attaches to, extracted from the bundle's own
     `host_collections` list of `{name, description}` dicts).
   - `_soe_host_collections` — the bundle's own `host_collections` list, concatenated straight
     through (already the exact shape `content_host_collections` takes).
3. Dispatches through **the same two task files** the flat actions use:
   `include_tasks: content_views.yml` with `content_lifecycle_environments`/`content_views`
   overridden to the derived facts, then `include_tasks: activation_keys.yml` with
   `content_host_collections`/`content_activation_keys` overridden the same way.

**Why only two `include_tasks` calls, not three.** `content_views.yml`'s own first task
*already* manages lifecycle environments — it is the identical `theforeman.foreman.
lifecycle_environment` call `lifecycle.yml` makes standalone. Calling `content_views.yml`
therefore already covers the lifecycle-environment half of an SOE bundle; a separate call to
`lifecycle.yml` would just re-run the same module a second time for the same object. This is
the same "reuse, don't duplicate" discipline the platform applies everywhere else, just inside
one role's own task files instead of across roles.

**`hostgroup` and `kickstart_snippet` are reference metadata, not managed here.** This role has
never managed Satellite hostgroups or provisioning templates via API — `content_hosts[]
.hostgroup` (the `host` action, above) has always been a by-name *reference* to a hostgroup
that already exists, created some other way (UI, `hammer`, or a future dedicated role). An SOE
bundle's `hostgroup`/`kickstart_snippet` follow the same honest boundary: they document which
Satellite hostgroup and kickstart snippet this OS build is meant to use, so that whoever
authors `content_hosts` entries against this SOE knows what to put in
`content_hosts[].hostgroup` — this role does not create either object. Inventing new
`theforeman.foreman.hostgroup`/provisioning-template API calls solely to round out this field
would be exactly the "parallel implementation" this feature is designed to avoid.

**Testable without a live Satellite.** `content_soe_bundles_execute` (default `true`) gates
*only* the two dispatch `include_tasks` calls — validation and the transform into `_soe_*`
facts always run. Setting it `false` proves the transform logic for real (asserting on the
derived `_soe_lifecycle_environments`/`_soe_content_views`/`_soe_host_collections`/
`_soe_activation_keys` facts) without ever making a Satellite API call, the same testing
posture `transfer_media` uses for its own no-external-dependency stage.

## Permutations & gotchas

- **Subscription required for a real run.** RHSM registration, CDN repos, and the manifest all
  need an entitled Red Hat subscription. Without one, use `foreman` instead.
- **Install gate covers only the installer command.** RHSM registration, repo enablement,
  package install, and firewall run regardless of `content_install_execute`. That is why
  molecule exercises the list-guarded API actions (true no-ops), not `install`.
- **`configure` / `status` hit the API.** Both need a reachable Satellite server; not used in
  molecule.
- **`content_no_log`** masks credential-bearing output — set `false` in dev only.

## Testing

`molecule/default` runs the role standalone with `content_install_execute: false`, empty
content lists, and the list-guarded actions (`cdn_repos`, `repos`, `sync`, `content_views`,
`activation_keys`, `lifecycle`, `host`, `export_content`, `import_content`, `soe_bundles`) plus
the negative (bad-action) path. It validates argument-spec enforcement, action dispatch, and the
shared-variable contract with no subscription or live Satellite. A real installation is
validated in the full-stack test lab (`inventories/test/`), not in molecule (CI has no
Satellite entitlement). Real bare-host create + PXE build (`action: host`), real content
export, real content import, and real SOE-bundle object creation against a live Satellite are
honestly UNCOVERED beyond the contract — Tier-3 lab request queued against the external
test-lab server (`output/satellite-cobbler-tier3-request.md`), not yet executed
(`docs/rhism-alignment-plan.md` Phase C items 2 and 3, and the reuse-map item 1 follow-up).

**`transfer_media` and `soe_bundles` are the two exceptions** — both get a genuine functional
test in molecule itself, not just contract validation, because both have a real path with no
Satellite API dependency:

- `transfer_media` makes no Satellite API call at all: the converge play writes real fixture
  files into a source tree, runs the actual `action: transfer_media`, and asserts the files
  landed at the destination — exercising the role's own internal checksum-verification path for
  real, plus a second converge play proving the fail-closed behaviour when
  `content_transfer_media_path` is left unset.
- `soe_bundles`'s **transform** (bundle → derived `content_views.yml`/`activation_keys.yml`
  shapes) has no Satellite API dependency either, as long as `content_soe_bundles_execute` is
  set `false`: a converge play runs the transform against one fixture SOE bundle and asserts on
  the resulting `_soe_lifecycle_environments`/`_soe_content_views`/`_soe_host_collections`/
  `_soe_activation_keys` facts, proving the transform is correct — genuinely, not just that
  dispatch occurred — before the (untested-in-CI) dispatch step would ever reach the API. A
  second converge play proves the same fail-closed discipline as the other list-guarded actions
  when a bundle is missing a required field.
