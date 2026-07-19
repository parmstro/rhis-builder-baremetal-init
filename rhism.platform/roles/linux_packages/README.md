# linux_packages

Security-focused package management for EL 8/9/10 — removes insecure legacy packages and installs hardening/auditing tooling. Dispatcher driven by `linux_packages_action`.

Namespace: `cx_ansible_galaxy`. Published as `cx_ansible_galaxy.linux_packages`.
Orchestration repo: `../../` — playbooks, inventory, CI scripts, and full platform `CLAUDE.md` live there.

## Requirements

- Collections: `ansible.builtin` (no additional collections required)
- EPEL must be available on the managed host if installing packages from EPEL (aide, rkhunter); set `linux_packages_enable_epel: true` to have the role install `epel-release` first

## Variable contract

| Variable | Default | Description |
|---|---|---|
| `linux_packages_action` | `all` | Dispatcher: `remove`, `install`, `all` (both), or `patch` |
| `linux_packages_remove` | `[telnet, rsh, rsh-server, ypserv, ypbind, tftp, tftp-server, xinetd]` | Packages to remove |
| `linux_packages_install` | `[aide, rkhunter, audit, firewalld]` | Packages to install |
| `linux_packages_enable_epel` | `false` | Install `epel-release` before the install step |
| `linux_packages_patch` | `[]` | Packages to upgrade when `action=patch` (often derived from CMDB CVE exposure data) |
| `linux_packages_patch_min_severity` | `HIGH` | Minimum CVSS severity to include when deriving the patch list from CMDB |

## Usage

### In a playbook

Include the role with `linux_packages_action` via `vars:`; override the package
lists from inventory `group_vars` where they differ per environment.

```yaml
- hosts: linux_servers
  become: true
  roles:
    # Run both steps (remove insecure + install tooling) with EPEL enabled
    - role: linux_packages
      vars:
        linux_packages_action: all
        linux_packages_enable_epel: true
        linux_packages_remove: [telnet, rsh, rsh-server, tftp]
        linux_packages_install: [aide, rkhunter, audit, firewalld]
```

```yaml
# Patch a CVE-affected package set (list usually derived from CMDB exposure data)
- hosts: linux_servers
  become: true
  roles:
    - role: linux_packages
      vars:
        linux_packages_action: patch
        linux_packages_patch: [openssl, glibc, sudo]
```

`linux_packages` is also chained by the `linux_security` orchestrator; it can be
run standalone as above.

### CLI

```bash
# Remove insecure packages only
ansible-playbook playbooks/linux_security.yml -e linux_packages_action=remove

# Install security tooling with EPEL enabled
ansible-playbook playbooks/linux_security.yml \
  -e linux_packages_action=install \
  -e linux_packages_enable_epel=true

# Run both steps (default)
ansible-playbook playbooks/linux_security.yml -e linux_packages_action=all
```

## Testing

```bash
cd roles/linux_packages && molecule test
```

Molecule tests run against AlmaLinux 8, 9, and 10 systemd-capable containers (binary-compatible with RHEL). The converge removes `telnet` and installs `audit` with EPEL enabled; verify asserts package state via `package_facts`.

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | almalinux:8, almalinux:9, almalinux:latest | All assertions pass |

**Scenario: default** — validates package lifecycle on EL8/9/10:

| Action | What is tested |
|---|---|
| `remove` | `telnet` package absent after action; `package_facts` confirms removal |
| `install` | `audit` package present after action with EPEL enabled; `package_facts` confirms install |
