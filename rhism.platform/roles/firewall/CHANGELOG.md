# Changelog

All notable changes to this role are documented here (Keep a Changelog
format; semantic versioning per `docs/role-versioning.md`).

## [Unreleased]

### Added
- Full standalone-first scaffolding (2026-07-11): `meta/main.yml`,
  `meta/argument_specs.yml`, `defaults/main.yml` (`firewall: []` for a clean
  no-op standalone run), lint configs, standard `.gitignore`, Tier 1 contract
  molecule scenario, README to the RH certified-content standard, this
  changelog.

### Fixed
- BUG-098: scalar `service:`/`port:` values iterated per-character (strings
  are iterable in Jinja); now normalised to one-element lists. `source` got
  the same normalisation.
- `rich_rule:` key documented in the README was never read (code used
  `item.rule` only) — both keys now honoured.
- All firewalld calls moved to the `ansible.posix.firewalld` FQCN; `loop`
  replaces `with_items`; task-name typo fixed.
