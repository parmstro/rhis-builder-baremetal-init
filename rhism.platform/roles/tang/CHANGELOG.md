# Changelog

All notable changes to this role are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Initial release. Tang/NBDE key-escrow server, standalone capability role
  (rhism alignment Phase C item 1, `docs/rhism-alignment-plan.md`).
- Actions: `deploy` (pull the official digest-pinned `rhel9/tang` image via
  `roles/podman`, run it with a persistent key volume + SELinux port label +
  firewalld opening), `verify` (real `clevis encrypt tang | clevis decrypt`
  round-trip).
- Tier 2 functional molecule scenario (`default`): real container deployed
  via the EE's podman socket, real clevis round-trip proven twice (before
  and after a re-deploy, proving key persistence).
- REQUIREMENTS.yml authored directly in the new user-story-lens schema
  (owner rule 2026-07-16) — first role built after that standard landed.
