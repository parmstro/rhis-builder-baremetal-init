# Changelog

All notable changes to this role are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Initial scaffold: `install` / `configure` / `upgrade` / `remove` actions for the
  KVM/libvirt hypervisor host platform. `install` handles qemu-kvm/libvirt packages and
  the libvirtd service; `configure` manages the default storage pool and network via
  `community.libvirt.virt_pool`/`virt_net` plus informational nested-virtualization
  sanity checks; `upgrade` bumps the package set to latest; `remove` is a gated,
  destructive teardown.
