# Changelog

All notable changes to this role are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-07-08

### Added
- Initial release: `register`/`unregister` actions, `activation_key` and
  `username_password` registration methods. Consolidates duplicated RHSM registration
  logic previously in `roles/rh_idm`, `roles/satellite`, `roles/gitlab_ee`, `roles/ocp`,
  and the wizard's licensing page.
