# wizard (rhism.platform.wizard)

Interactive infrastructure wizard that collects estate deployment choices via
a TUI (whiptail) and writes a deployment manifest consumed by
`rhism.platform.builder`. Supports a pre-baked `estate` profile (the
governed-RHEL estate this collection exists for) and a fully custom
interactive path.

This is rhism's own independent estate wizard (owner decision
2026-07-16: rhism carries its own wizard rather than depending on another
collection's wizard at runtime) — it narrows the profile set to just the
two that are actually rhism's own domain: `estate` and `custom`.

## Requirements

- Collections: none (uses only `ansible.builtin`)
- System: `newt` package (provides `whiptail`) for interactive mode — not needed
  for profile-driven or CI mode
- Auth: none — credentials collected interactively and written to manifest

## Variable contract

| Variable | Default | Description |
|----------|---------|-------------|
| `wizard_action` | `interactive` | `interactive\|validate\|show_plan\|generate_inventory` |
| `wizard_output_dir` | `/opt/rhism/manifests` | Directory for manifest output |
| `wizard_output_file` | `rhism-deployment-manifest.yml` | Manifest filename — a deliberately distinct default, so two manifests never silently overwrite each other on a shared control host |
| `wizard_profile` | `""` | Pre-baked profile: `estate\|custom\|""` |
| `wizard_estate_sizing_tier` | `l` | Which tier (`s\|m\|l`) of the `estate` profile's sizing figures becomes the manifest's real sizing block |
| `wizard_skip_confirm` | `false` | Skip review/confirm page (CI mode) |
| `wizard_tui_backend` | `whiptail` | TUI backend: `whiptail\|dialog` |
| `wizard_network` | `{}` | Pre-set to skip network page (CI mode) |
| `wizard_sizing` | `{}` | Accumulated runtime manifest state — pre-set to skip the interactive sizing page (CI mode); NOT the same variable as `wizard_tool_sizing` below |
| `wizard_credentials` | `{}` | Pre-set to skip credentials page (CI mode) |
| `wizard_licensing` | `{}` | Pre-set to skip licensing page (CI mode) |

### Capacity planning (t-shirt sizing)

Two distinct things are sized here — don't confuse them:

1. **The wizard tool itself** — trivial, since it's pure control-node logic
   with no persistent service. Additive figures, OS baseline (1 vCPU / 2 GB
   / 20 GB, RHEL 9) excluded; see `docs/capacity-planning.md`.

   | Tier (`wizard_tool_sizing`) | CPU | RAM | Disk |
   |---|---|---|---|
   | `s` (default, only tier — invariant workload) | 1 | 512 MB | 1 GB |

2. **The estate the `estate` profile describes** — the real capacity
   rating that matters, selected via `wizard_estate_sizing_tier`. Figures
   are this platform's own measured/estimated sizing (no single vendor doc
   covers "IdM + Satellite + AAP + KVM + Tang as one estate" — labeled
   honestly per `capacity-planning.md`'s no-vendor-guidance rule):

   | Tier | Identity server | Content server | Hypervisor hosts | Tang hosts |
   |---|---|---|---|---|
   | `s` | 4 vCPU / 8 GB / 100 GB | 4 vCPU / 8 GB / 500 GB | 8 vCPU / 32 GB / 500 GB ×2 | 1 vCPU / 2 GB / 20 GB ×2 |
   | `m` | 8 vCPU / 16 GB / 100 GB | 8 vCPU / 16 GB / 500 GB | 16 vCPU / 64 GB / 1 TB ×2 | 2 vCPU / 4 GB / 20 GB ×2 |
   | `l` (default) | 8 vCPU / 16 GB / 100 GB | 8 vCPU / 16 GB / 500 GB | 16 vCPU / 64 GB / 1 TB ×3 | 2 vCPU / 4 GB / 20 GB ×3 |

## Usage

### Interactive (full wizard — requires TTY and newt):

```bash
ansible-playbook rhism.platform.wizard
```

### Profile-driven (no TTY — for CI and automated builds):

```bash
ansible-playbook rhism.platform.wizard \
  -e wizard_profile=estate \
  -e wizard_estate_sizing_tier=m \
  -e wizard_output_dir=/tmp/manifests \
  -e wizard_skip_confirm=true \
  -e '{"wizard_network": {"domain": "corp.example.com", "subnet": "10.0.0.0/24", "gateway": "10.0.0.1", "dns": ["10.0.0.1"]}}' \
  -e '{"wizard_credentials": {"admin_password": "VaultedInPractice"}}'
```

### Validate an existing manifest:

```bash
ansible-playbook rhism.platform.wizard -e wizard_action=validate
```

### Show deployment plan:

```bash
ansible-playbook rhism.platform.wizard -e wizard_action=show_plan
```

### Generate Ansible inventory from manifest:

```bash
ansible-playbook rhism.platform.wizard -e wizard_action=generate_inventory
```

## Testing

```bash
cd roles/wizard && molecule test
```

Interactive test (manual — requires TTY):

```bash
cd roles/wizard && molecule converge -s interactive
```

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9/ubi-minimal:latest | PASS (2026-07-16) — estate profile at both sizing tiers, validate/show_plan/generate_inventory, dispatcher rejection |

**Scenario: default** — validates pre-baked profile manifest generation and dispatcher routing (no TTY / no whiptail):

| Test | What is verified |
|---|---|
| `interactive` (estate profile, `s` tier) | Manifest rendered to `/tmp/wizard-test/estate-small-manifest.yml` with network/credentials; skips interactive whiptail pages via `wizard_profile` |
| `interactive` (estate profile, `l` tier — the real default) | Manifest rendered to `/tmp/wizard-test/estate-large-manifest.yml`; sizing figures asserted to genuinely differ from the `s`-tier manifest above (real tier selection, not a static fixture) |
| `validate` | Validates the large-tier manifest generated above; asserts required fields present |
| `show_plan` / `generate_inventory` | Both actions run cleanly against the large-tier manifest; `generate_inventory` output checked to exist |
| Dispatcher rejects invalid `wizard_action` | `invalid_action` raises assertion error (caught in rescue block) |

`rhism.platform.wizard`'s `wizard_profile` has no legacy profile-id aliases —
the only valid values are `estate`, `custom`, and `""` — so there is no
deprecated-alias mapping to test.

Bugs found building this role (see `roles/cmdb/vars/platform_bugs.yml`),
still relevant here:
- **BUG-042** — `include_vars`'s relative-path search excludes `files/` when the role loads from a collection; fixed with an explicit `role_path`-qualified path.
- **BUG-043** — `wizard_licensing` was never populated on the pre-baked-profile path; added derivation of `rhsm/satellite/ocp/gitlab_ee` flags from component types.

The interactive TUI path (whiptail dialogs) requires a real TTY. Run `molecule converge -s interactive` manually to test the full wizard flow.
