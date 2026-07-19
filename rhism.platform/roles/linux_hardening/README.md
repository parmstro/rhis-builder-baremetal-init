# linux_hardening

OS-level security hardening for EL 8/9/10 — sysctl kernel parameters, SSH daemon configuration, PAM/password quality policy, and kernel module blacklisting. Dispatcher driven by `linux_hardening_action`.

Namespace: `cx_ansible_galaxy`. Published as `cx_ansible_galaxy.linux_hardening`.
Orchestration repo: `../../` — playbooks, inventory, CI scripts, and full platform `CLAUDE.md` live there.

## Requirements

- Collections: `ansible.posix` (sysctl module), `community.general` (modprobe module), `ansible.builtin`
- `openssh-server` must be installed for sshd_config validation (`sshd -t`) to succeed
- `libpwquality` must be installed for pwquality.conf to take effect

## Variable contract

### Dispatcher

| Variable | Default | Description |
|---|---|---|
| `linux_hardening_action` | `all` | `sysctl`, `ssh`, `pam`, `kernel_modules`, or `all` (runs all four) |

### SSH hardening (`ssh` action)

| Variable | Default | Description |
|---|---|---|
| `linux_hardening_manage_ssh` | `true` | Set to `false` to skip sshd_config management entirely |
| `linux_hardening_ssh_port` | `22` | SSH port |
| `linux_hardening_ssh_permit_root_login` | `"no"` | PermitRootLogin value |
| `linux_hardening_ssh_password_auth` | `"no"` | PasswordAuthentication value |
| `linux_hardening_ssh_max_auth_tries` | `4` | MaxAuthTries |
| `linux_hardening_ssh_client_alive_interval` | `300` | ClientAliveInterval (seconds) |
| `linux_hardening_ssh_client_alive_count_max` | `0` | ClientAliveCountMax |
| `linux_hardening_ssh_allowed_groups` | `[]` | Groups in AllowGroups; empty = no restriction |
| `linux_hardening_ssh_manage_sftp` | `false` | Whether to include Subsystem sftp line |
| `linux_hardening_ssh_install_server` | `true` | Install openssh-server before deploying config. `false` = config-only bake (image builds; EL8+py3.11 can't run the package module — BUG-104) |
| `linux_hardening_ssh_validate` | `true` | Validate with `sshd -t` before install. `false` where no host keys exist (image builds — a shared base must not bake them; BUG-104) |

### Sysctl hardening (`sysctl` action)

| Variable | Default | Description |
|---|---|---|
| `linux_hardening_sysctl_params` | dict (10 CIS-aligned params) | Map of `parameter: value` pairs passed to `ansible.posix.sysctl` |
| `linux_hardening_sysctl_apply` | `true` | `false` = write config only via `lineinfile` (no live apply, no sysctl-binary dependency — containers/minimal images; BUG-020/BUG-103) |
| `linux_hardening_sysctl_file` | `/etc/sysctl.conf` | Destination file for the hardening parameters (both modes) |

Default params cover: `kernel.dmesg_restrict`, `kernel.kptr_restrict`, `kernel.randomize_va_space`, IPv4/IPv6 redirect/RP-filter settings.

### Kernel module blacklisting (`kernel_modules` action)

| Variable | Default | Description |
|---|---|---|
| `linux_hardening_blacklisted_modules` | `[usb-storage, cramfs, freevxfs, jffs2, hfs, hfsplus, squashfs, udf]` | Modules to remove and mark persistent-absent via `community.general.modprobe` |
| `linux_hardening_modules_apply` | `true` | `false` = write `/etc/modprobe.d/` blacklist config only (no live unload, no kmod dependency — minimal images; BUG-105) |

Set to `[]` in Molecule converge to avoid modprobe errors inside containers.

### PAM / password quality (`pam` action)

| Variable | Default | Description |
|---|---|---|
| `linux_hardening_pwquality_minlen` | `14` | Minimum password length |
| `linux_hardening_pwquality_dcredit` | `-1` | Digit credit (-N = require N digits) |
| `linux_hardening_pwquality_ucredit` | `-1` | Uppercase credit |
| `linux_hardening_pwquality_ocredit` | `-1` | Special character credit |
| `linux_hardening_pwquality_lcredit` | `-1` | Lowercase credit |

## Usage

```bash
# Full hardening (all four sub-actions)
ansible-playbook playbooks/linux_security.yml -e linux_hardening_action=all

# SSH hardening only
ansible-playbook playbooks/linux_security.yml -e linux_hardening_action=ssh

# Harden sysctl, skip module blacklisting (e.g. on a VM where modules aren't loaded)
ansible-playbook playbooks/linux_security.yml \
  -e linux_hardening_action=all \
  -e '{"linux_hardening_blacklisted_modules": []}'
```

## Testing

```bash
cd roles/linux_hardening && molecule test
```

Molecule runs against AlmaLinux 8, 9, 10 systemd containers. The converge exercises sysctl, SSH, and PAM actions; kernel_modules is called with an empty list to avoid container modprobe errors. Verify asserts sshd_config and pwquality.conf content.

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | almalinux:8, almalinux:9, almalinux:latest | All assertions pass |

**Scenario: default** — exercises CIS/STIG hardening actions in containers:

| Action | What is tested |
|---|---|
| `sysctl` | Kernel parameters generated; apply skipped (`linux_hardening_sysctl_apply: false` — containers cannot set host kernel params) |
| `ssh` | `/etc/ssh/sshd_config` rendered with `PermitRootLogin no`, `PasswordAuthentication no`; content asserted |
| `pam` | `/etc/security/pwquality.conf` rendered; `minlen` and `minclass` content asserted |
| `kernel_modules` | Blacklist file generated; empty module list used (no host modules to unload in containers) |

`sysctl` apply and actual SSH reload require a non-container host or privileged container.

### Bugfixes

- **BUG-103 (2026-07-12)**: `ansible.posix.sysctl` requires the `sysctl` binary
  (procps-ng) even in config-only mode (`sysctl_set/reload: false`) — absent on
  minimal images (UBI base). Config-only mode now writes the entries to
  `linux_hardening_sysctl_file` via `lineinfile`, no external binary.
- **BUG-104 (2026-07-12)**: sshd hardening couldn't run on image builds — the
  template's `sshd -t` validation needs host keys (baking them into a shared
  base would give every derived container identical host keys), and the
  openssh-server install is wrong for a config-only bake (and impossible on
  EL8+python3.11, BUG-018 class). New `linux_hardening_ssh_validate` and
  `linux_hardening_ssh_install_server` toggles, both default true (host
  behaviour unchanged).
- **BUG-105 (2026-07-12)**: `community.general.modprobe` requires the
  `modprobe` binary (kmod) even for the persistent-config half — absent on
  UBI. New `linux_hardening_modules_apply` toggle; config-only mode writes
  CIS-style `install <mod> /bin/false` + `blacklist <mod>` files to
  `/etc/modprobe.d/`.

