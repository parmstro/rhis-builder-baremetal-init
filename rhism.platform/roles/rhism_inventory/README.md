# rhism_inventory

## Description

Owns the SOE (Standard Operating Environment) catalogue as platform data.
A catalogue is a flat directory of YAML files, one self-contained SOE bundle
per file, following the upstream SOE bundle model (`schema/soe_bundle_model.md`
in the rhis-builder-inventory design proposal): `content` (repository sets,
custom products, content views), `templates` (provisioning templates,
partition tables, priority-weighted snippets), `lifecycle` (lifecycle
environments, activation keys, hostgroups), and `infrastructure_refs`
(assertions against existing site infrastructure — never created by a bundle).

Four actions, all running entirely on the control node:

- **validate** (default, read-only) — schema-check every selected entry:
  name + at least one model section, integer snippet priorities, known
  `lifecycle_state` values, only the four known `infrastructure_refs` keys.
- **aggregate** — merge the selected bundles into the flat, **deduplicated**
  Satellite list shapes and write ONE `include_vars`-ready YAML file:
  `content_soe_bundles` (one bundle per activation key, loadable straight
  into the `satellite` role's `soe_bundles` action), satellite's own
  `content_cdn_repository_sets` / `content_products` /
  `content_lifecycle_environments` / `content_views` /
  `content_activation_keys` flat names, `content_hostgroups` (reference
  metadata — the satellite role never creates hostgroups), and
  `content_presync_sources` — the sync gate: every content section across
  all bundles in a single pre-sync list.
- **generate** — derive the high-signal deployment inventory content from a
  wizard deployment manifest (or direct vars): `group_vars/all/derived.yml`
  (domain, realm, DNS/gateway addresses, reverse DNS zones, time servers), a
  restrictive `vault/` skeleton (no secret is ever generated), and the
  aggregated SOE chain (the aggregate implementation, reused). Network
  derivations run on the **full CIDR** with `ansible.utils` filters —
  deliberately fixing the upstream generator's classful /24-only octet-split
  bug: a /22 network yields all four reverse zones, not just the first.
  Composes with the `wizard` role — the wizard owns `hosts.yml` group
  generation; this role never re-renders it.
- **publish** — copy the selected, filtered entries as individual
  `<name>.yml` files into a flat directory, the exact contract the
  `rhism_ui` backend serves (`readdir *.yml`, each file one entry).

Selection and filtering are shared by every action: `rhism_inventory_bundles`
selects entries by name (empty = all), and the lifecycle filter drops entries
with `lifecycle_state: deprecated`. The role ships a bundled reference
catalogue (`files/catalog/` — trimmed, real Red Hat object names for RHEL 9
and RHEL 10, with provenance headers) used whenever no catalogue directory is
given.

## Requirements

- ansible-core 2.15+.
- The `ansible.utils` collection **plus the `netaddr` Python library** (the
  nthhost/ipsubnet/ipaddr filters used by `generate` import netaddr at run
  time). In this platform both the **infra EE** (`ansible_galaxy_infra_ee`,
  since the BUG-176 fix) and the **net EE** carry the pair; the base EE has
  neither.
- No target host: every action runs on the control node (localhost). Nothing
  is installed and no service is touched.

## Role Variables

All defaults live in `defaults/main.yml` and are validated by
`meta/argument_specs.yml` at role entry.

| Variable | Default | Purpose |
|---|---|---|
| `rhism_inventory_action` | `validate` | `validate`, `aggregate`, `generate`, or `publish` |
| `rhism_inventory_catalog_dir` | `""` | Catalogue directory; empty = the bundled reference catalogue at `files/catalog/` |
| `rhism_inventory_bundles` | `[]` | Entry names to select; empty = all |
| `rhism_inventory_lifecycle_filter` | `true` | Drop `lifecycle_state: deprecated` entries |
| `rhism_inventory_manifest_path` | `""` | Wizard deployment manifest for `generate` (reads `network.domain` / `network.subnet` / optional `network.realm`) |
| `rhism_inventory_domain` | `""` | Standalone fallback domain for `generate` (with the CIDR below) |
| `rhism_inventory_network_cidr` | `""` | Standalone fallback network CIDR for `generate` — any prefix length |
| `rhism_inventory_dns_host_offset` | `10` | DNS server = nthhost(offset) of the CIDR (upstream parity: next_nth_usable(10)) |
| `rhism_inventory_gateway_offset` | `1` | Gateway = nthhost(offset) of the CIDR |
| `rhism_inventory_time_servers` | `[]` | NTP servers passed through into the derivations |
| `rhism_inventory_output_dir` | `{{ playbook_dir }}/../output/rhism_inventory` | Where aggregate/generate write |
| `rhism_inventory_publish_dir` | `{{ rhism_inventory_output_dir }}/soe_catalog` | Flat directory publish writes for rhism_ui |
| `rhism_inventory_vault_dir_mode` | `"0700"` | Mode of the generated vault skeleton directory |

## Use Cases / Example Playbooks

### Standalone — validate and aggregate the bundled reference catalogue

```yaml
- name: Aggregate the SOE catalogue into satellite-ready shapes
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Validate the catalogue
      ansible.builtin.include_role:
        name: rhism.platform.rhism_inventory
      # rhism_inventory_action defaults to validate

    - name: Aggregate selected bundles
      ansible.builtin.include_role:
        name: rhism.platform.rhism_inventory
      vars:
        rhism_inventory_action: aggregate
        rhism_inventory_bundles: [rhel9_soe]
        rhism_inventory_output_dir: "{{ playbook_dir }}/output/soe"
```

### Standalone — generate deployment content from direct vars (no manifest)

```yaml
- name: Generate estate derivations for a /22 network
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Generate the deployment tree
      ansible.builtin.include_role:
        name: rhism.platform.rhism_inventory
      vars:
        rhism_inventory_action: generate
        rhism_inventory_domain: soe.example.com
        rhism_inventory_network_cidr: 10.20.0.0/22
        rhism_inventory_output_dir: "{{ playbook_dir }}/output/soe"
```

### Composed — wizard manifest in, satellite call out

```yaml
- name: Wizard manifest -> SOE inventory -> Satellite content
  hosts: localhost
  gather_facts: false
  tasks:
    # 1. The wizard produced deployment-manifest.yml (and owns hosts.yml).
    - name: Generate the SOE deployment content from the manifest
      ansible.builtin.include_role:
        name: rhism.platform.rhism_inventory
      vars:
        rhism_inventory_action: generate
        rhism_inventory_manifest_path: "{{ playbook_dir }}/output/deployment-manifest.yml"
        rhism_inventory_output_dir: "{{ playbook_dir }}/output/soe"

    # 2. Load the aggregated chain and hand it to the satellite role.
    - name: Load the aggregated SOE chain
      ansible.builtin.include_vars:
        file: "{{ playbook_dir }}/output/soe/deployment/group_vars/all/aggregated_soe.yml"

- name: Apply the SOE bundles on Satellite
  hosts: sat_primary
  gather_facts: false
  tasks:
    - name: Manage SOE content via the satellite role
      ansible.builtin.include_role:
        name: rhism.platform.satellite
      vars:
        action: soe_bundles
        # content_soe_bundles came from the include_vars above.
```

### Publish the catalogue for the web UI

```yaml
- name: Publish the SOE catalogue for rhism_ui
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Publish catalogue entries
      ansible.builtin.include_role:
        name: rhism.platform.rhism_inventory
      vars:
        rhism_inventory_action: publish
        rhism_inventory_publish_dir: /srv/rhism/soe_catalog
```

## Testing

One Tier 2 functional molecule scenario (`molecule/default`) — the role's real
target IS the control node, so converge exercises all four actions for real:
the shipped reference catalogue plus fixtures proving cross-bundle dedup
(a second bundle re-declaring the SOE9 content view), the deprecated-entry
filter, a negative schema-validation play and a negative argument-spec play
(block/rescue), and a `generate` run from a /22 wizard manifest whose reverse
DNS zone set is asserted against the true classless answer (all four /24
child zones — explicitly not the octet-split single zone). Run inside the
infra EE (carries ansible.utils + netaddr since the BUG-176 fix; the net EE
also works):

```bash
podman machine ssh "cd <repo> && source bin/ci-lib.sh && \
  run_in_ee ansible_galaxy_infra_ee:latest sh -c \
  'cd /workspace/collections/rhism/platform/roles/rhism_inventory && molecule test'"
```

## Support / License

MIT. Community-maintained; no commercial support.

## Related Information

- Depth doc: `docs/rhism_inventory.md` (internals, permutations, workflows)
- Upstream SOE bundle model: `rhis-builder-inventory`'s
  `schema/soe_bundle_model.md` (design proposal by parmstro)
- Consumers: the `satellite` role (`soe_bundles` action), the `rhism_ui` role
  (catalogue web UI), the `wizard` role (manifest producer)

## Molecule test results

| Scenario | Platform | Result | Date |
|---|---|---|---|
| default | localhost (control node) + ubi9-minimal placeholder | PASS — syntax, converge (all 4 actions + 2 negative plays), verify, destroy (net EE, re-proven on the rebuilt infra EE post-BUG-176) | 2026-07-17 |

## Bugfixes

None yet.
