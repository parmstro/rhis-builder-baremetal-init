# cobbler — role depth doc

Internals, workflow, and operational notes for the `cobbler` role. See the role `README.md`
for the quick-start and variable table; this doc is for people using or maintaining the role
in depth.

## What it deploys

[Cobbler](https://cobbler.github.io/) — a full provisioning server that manages PXE/DHCP/DNS
plus a distro → profile → system content model with kickstart templates. It suits sites that
provision many machines from managed OS trees but do not run Satellite or Foreman. The role
installs the packages, renders `settings.yaml`, runs `cobbler sync`, and offers per-object
lifecycle actions for distros, profiles, and systems.

## Where it sits

`cobbler` is one of the **provisioning backend** product roles selected by the
`provisioning_services` dispatcher (`prov_type`): `dnsmasq`, `cobbler`, `foreman_proxy`,
`satellite_proxy`. A site uses exactly one. Each backend is a separate, standalone-first role
and the family is open.

### Shared variable interface ("sameness")

Every provisioning backend consumes the **same** variable names (bare `action` + `prov_*`), so
the dispatcher selects any of them with one identical call and no per-backend code:

| Variable | Meaning | Scope |
|---|---|---|
| `action` | `present`/`absent`/`configure`/`add_distro`/`add_profile`/`add_system`/`remove_system`/`sync`/`status`/service | shared by all backends |
| `prov_execute` | dry-run gate (`false` = validate only) | shared |
| `prov_cobbler_server`, `prov_cobbler_next_server` | Cobbler + TFTP next-server | cobbler |
| `prov_cobbler_manage_dhcp`/`dns`/`tftp` | which services Cobbler manages | cobbler |
| `prov_cobbler_distro`/`profile`/`system`/`system_name` | per-action object inputs | cobbler |

The role ships defaults for all of these (`defaults/main.yml`), so it runs standalone. The
interface is declared and validated in `meta/argument_specs.yml` (ansible-core runs the
validation at role entry — there is no manual `assert`).

## Dry-run gate

`prov_execute` (default `true`) is the shared gate. With `prov_execute: false` the role
validates the argument spec and action dispatch but skips every task file, so no packages are
installed and no `cobbler` CLI runs — this is what the molecule scenario exercises.

## Selection & call flow

```
provisioning_services (prov_action: baseline|install|configure, prov_type: cobbler)
        │  include_role name={{ prov_type }}   vars: {action: present|configure}
        ▼
cobbler ── argument_spec validation ── action, prov_execute=true ──► dispatch to <action>.yml
        ▲
   standalone playbook  roles: [cobbler]  vars: {action: present}  ────────────────────────┘
```

## Actions

- **present / absent** — install/remove `cobbler`, `cobbler-web`, `pykickstart`,
  `fence-agents`, plus `httpd`; open/close dns/dhcp/tftp/http/https in firewalld.
- **configure** — render `settings.yaml`, ensure `/var/lib/tftpboot` (gated on
  `prov_cobbler_manage_tftp`), then `cobbler sync`.
- **add_distro** — `cobbler distro add` from `prov_cobbler_distro` (name/kernel/initrd
  required; arch/breed/os_version optional).
- **add_profile** — `cobbler profile add` from `prov_cobbler_profile` (name/distro required;
  optional kickstart).
- **add_system** — `cobbler system add` from `prov_cobbler_system`
  (name/profile/mac/ip/hostname required).
- **add_systems** — bulk `add_system` from `prov_cobbler_systems` (a list of the same shape).
  See "Bulk registration" below.
- **remove_system** — `cobbler system remove` by `prov_cobbler_system_name`.
- **sync** — `cobbler sync`.
- **status** — `cobbler status`, reported via debug.
- **started / stopped / restarted** — `cobblerd` + `httpd` service state.

## Bulk registration (`action: add_systems`) — rhism alignment Phase C item 2

Added 2026-07-16 as the *light* path for bare-host provisioning — the
same underlying outcome `roles/satellite`'s new `host` action provides on
the *heavy* (Satellite-integrated) path, for a site that runs neither
Satellite nor Foreman and doesn't want to.

**The mechanics**: `add_systems` is a thin loop, nothing more — it
`include_tasks`'s the *existing* `add_system.yml` once per entry in
`prov_cobbler_systems`, with a dedicated `loop_var`
(`_prov_cobbler_bulk_system`) so the loop-derived values don't get shadowed
by anything inside `add_system.yml` itself (a documented Ansible gotcha:
lazily-templated `include_tasks` vars referencing the *outer* play's `item`
get silently overwritten by an *inner* task's own loop if you reuse the
bare name `item` at both levels — always use a distinct `loop_var` when
passing loop-derived values into an included file, per the platform's own
`playbooks/test_xray_reports.yml` finding).

Each iteration still runs the exact same `cobbler system add --name=...
--profile=... --mac=... --ip-address=... --hostname=...` command
`add_system.yml` always has — registering the system's MAC/IP/hostname
against a named profile so Cobbler's DHCP/TFTP/PXE stack knows to hand that
specific machine the right boot files the next time it network-boots. There
is deliberately **no new Cobbler-facing mechanism here** — bulk input was
the actual gap (RHIS provisions estates from a *list* of hosts, one call;
`add_system` alone only ever handled one host per call), not anything about
how Cobbler itself registers a system.

**What this does NOT do** (same honest boundary as `roles/satellite`'s
`host` action): trigger a reboot/PXE-boot, or wait for the resulting
kickstart install to finish. Cobbler itself has no equivalent of Satellite's
`host_power` API — kicking a real machine's power state is out of this
role's scope entirely (BMC/hypervisor/out-of-band-management concern, not a
provisioning-server concern). An operator (or a Tier-3 lab playbook) drives
the actual reboot after `add_systems` has registered the batch.

## Permutations & gotchas

- **Run `present` (or `configure`) before object actions.** `add_distro`/`add_profile`/
  `add_system` shell out to the `cobbler` CLI, which requires the daemon installed and running.
- **Object actions report `changed: true` unconditionally** (`changed_when: true` on the
  `command` tasks) — they are not idempotent by inspection; re-running an `add_*` for an
  existing object errors from Cobbler, not from the role.
- **`sync` after edits.** `configure` runs `cobbler sync` for you; standalone object edits
  should be followed by an explicit `action: sync` to regenerate PXE menus.
- **`httpd` is managed alongside `cobblerd`.** Both packages and both services move together
  on `present`/`absent` and the service actions.

## Testing

`molecule/default` runs the role standalone with `prov_execute: false` — it validates
argument-spec enforcement, action dispatch, the shared-variable contract, and the negative
(bad-action) path, with no packages installed and no CLI invoked. `add_systems` is exercised
with a 2-entry fixture list under the same dry-run gate. A real Cobbler deployment (including
real bulk registration + PXE boot) is validated in the full-stack test lab (`inventories/test/`),
not in molecule — the bulk-specific real-world pass is honestly UNCOVERED beyond the
contract, a queued follow-up (`docs/rhism-alignment-plan.md` Phase C item 2).
