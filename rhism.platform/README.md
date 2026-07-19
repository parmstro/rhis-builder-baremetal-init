# rhism.platform

> **Built on RHIS — the Red Hat Infrastructure Standard, by [Paul Armstrong
> (@parmstro)](https://github.com/parmstro).** This collection **aligns his RHIS with
> current versions and integrates additional capabilities**, offered back with
> gratitude — a contribution to RHIS, not a replacement for it. Full credit:
> [`CREDITS.md`](CREDITS.md).

**rhism — RHIS aligned to current versions, with additional integrations** (Red Hat
Infrastructure Standard). This collection hosts the real, hardened,
actively-maintained deliverables that came from aligning RHIS to current versions and
integrating additional capabilities into a repeatable way of working — starting with a
security-fixed fork of RHIS's web-based estate-manifest UI.

**Not yet merged into `rhism.platform`/`rhism.platform`** — this
collection stays standalone for now, with a documented aspiration to
propose merging once it's finalised and proven. See
`docs/rhism-alignment-plan.md` in the orchestration repo for the full
alignment story.

## Relationship to the rest of this platform

- **`roles/rhism/`** (a separate, independent GitLab repo) is the vendored
  upstream reference/provenance area — RHIS's own source, unmodified,
  documented in its own `PROVENANCE.md`. This collection does **not**
  replace it; it forks FROM it, with its own provenance trail.
- **`rhism.platform.wizard`** is this platform's real, existing TUI —
  already an interactive terminal wizard for building an estate manifest.
  This collection's `rhism_ui` role is a **complementary web-based
  alternative** for the same job, not a competing orchestrator (the
  guiding principle: one wizard, one builder, one estate
  definition — `rhism_ui` produces/consumes the same kind of manifest
  data, it does not deploy anything itself).

## Roles

| Role | Purpose |
|---|---|
| `rhism.platform.rhism_ui` | Security-hardened fork of RHIS's web UI for browsing the SOE catalog and building a deployment session — real auth, restricted CORS, and sanitized path handling added on top of the vendored original. Builds the real image from source and deploys it via `roles/podman`, with a real Tier-2 functional molecule scenario (see `docs/rhism-ui.md`). |

## Dependencies

Declared in `galaxy.yml`: `rhism.platform`
(`>=1.6.0`). Note this declared dependency is aspirational/not yet exercised
by `rhism_ui` today — `rhism_ui` actually reuses `roles/podman` from the
**orchestration repo's own `roles/` tree** (not vendored into any
collection), resolved via `ANSIBLE_ROLES_PATH` at role-entry time — the same
mechanism `roles/tang` and `roles/quay` already rely on. See
`roles/rhism_ui/tasks/install.yml`'s header comment for the full
resolution story.

This project does not publish either collection to a Galaxy-compatible index
or Automation Hub, so `galaxy.yml`'s `dependencies:` entry does **not**
resolve automatically. Install explicitly via the bundled `requirements.yml`:

```bash
ansible-galaxy collection install -r requirements.yml -p ./collections
```

## Support / License

Platforms: EL9 control node. License: MIT.

See the orchestration repo's `docs/rhism-alignment-plan.md` for the full
alignment design and status, and `docs/rhism-ui.md` for `rhism_ui`'s
own depth doc (fixes, security re-scan, relationship to
`rhism.platform.wizard`).
