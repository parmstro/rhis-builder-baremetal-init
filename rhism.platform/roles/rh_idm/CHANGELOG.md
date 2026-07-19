# Changelog

All notable changes to this role are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- **BUG-114**: `action: server` called the ansible_freeipa `ipaserver`
  *topology* module with installation parameters — the deploy action could
  never install a server (defect shared with the freeipa sibling, where the
  functional scenario surfaced it). Refit to the collection's `ipaserver`
  **role** (`idm_*` → `ipaserver_*` mapping).
- **BUG-115**: default `idm_idstart: 50000` failed IdM install validation on
  EL (`/etc/login.defs` UID_MAX 60000) — raised to `100000`.

### Added
- `idm_manage_firewall` (default `true`) — gate the firewalld steps for
  containers / externally-managed firewalls; maps to
  `ipaserver_setup_firewalld` on install.

## [1.1.0] - 2026-07-08

### Added
- `otp`, `smart_card`, `radius_proxy` actions — multi-factor authentication config,
  moved here from `identity_management` (which duplicated this logic inline instead of
  delegating — see the orchestration-role sprawl cleanup).

### Fixed
- BUG-093: `trust.yml`'s new DNS-forward-zone step passes `idm_forwarders` through
  `community.general.dict_kv` — `ipadnsforwardzone`'s `forwarders` param needs a list of
  `{ip_address: ...}` dicts, not plain strings (verified via `ansible-doc`).
- BUG-094: `prepare_server.yml`'s module-enable/package-install/firewall tasks had no
  dry-run gate at all, running unconditionally even when `idm_server_install`/
  `idm_replica_install` were `false`. Wrapped in a `block:` gated on either flag
  (`rhel_subscription`'s own inclusion keeps its separate `rhel_subscription_skip` gate).
- `trust.yml` now uses the real `freeipa.ansible_freeipa.ipatrust` module (confirmed via
  `ansible-doc`) instead of shelling out to `ipa trust-add`, plus configures the AD
  domain's DNS forward zone first — logic absorbed from `identity_management`'s more
  complete implementation during the sprawl cleanup.

## [1.0.0] - 2026-07-01

### Added
- Initial standalone-first release.
