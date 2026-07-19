# provisioning_services

Provisioning services role — dnsmasq (PXE/DHCP/DNS), Cobbler, or Foreman/Satellite Smart Proxy.

## Actions

| `prov_action` | Description |
|---|---|
| `install` | Install packages for the selected type |
| `configure` | Deploy configuration templates |
| `baseline` | Install + configure in dependency order |

## Types

| `prov_type` | Description |
|---|---|
| `dnsmasq` | Single-process DHCP + TFTP + DNS (lightweight default) |
| `cobbler` | Cobbler provisioning server (profiles, systems, distros) |
| `satellite_proxy` | Satellite Smart Proxy (TFTP + DHCP + DNS + content) |
| `foreman_proxy` | Foreman Smart Proxy (TFTP + DHCP + DNS) |

## Requirements

- RHEL/CentOS 8 or 9
- `become: true` — all tasks require privilege escalation
- Smart proxy types require `redhat.satellite` or `theforeman.foreman` collection
- `prov_install_execute: true` required to install packages (default: false — dry run)

## Variables

```yaml
# Required
prov_action: baseline          # install | configure | baseline
prov_type: dnsmasq             # dnsmasq | cobbler | satellite_proxy | foreman_proxy
prov_domain: example.com       # local DNS domain

# Gate (default false — dry run)
prov_install_execute: false

# Orchestrator toggles (baseline action)
prov_apply_install: true
prov_apply_configure: true

# DNS
prov_dns_upstream:
  - 8.8.8.8
  - 8.8.4.4
prov_dns_listen_address: "{{ ansible_default_ipv4.address }}"

# DHCP
prov_dhcp_enabled: true
prov_dhcp_range_start: "192.168.1.100"
prov_dhcp_range_end: "192.168.1.200"
prov_dhcp_lease_time: 12h
prov_dhcp_gateway: "{{ ansible_default_ipv4.gateway }}"

# PXE / TFTP
prov_tftp_enabled: true
prov_tftp_root: /var/lib/tftpboot
prov_pxe_kernel: pxelinux.0

# Cobbler-specific
prov_cobbler_server: "{{ ansible_default_ipv4.address }}"
prov_cobbler_next_server: "{{ ansible_default_ipv4.address }}"
prov_cobbler_manage_dhcp: true
prov_cobbler_manage_dns: true
prov_cobbler_manage_tftpd: true

# Smart proxy (satellite_proxy | foreman_proxy)
prov_smartproxy_url: ""        # Content server URL
prov_smartproxy_username: ""
prov_smartproxy_password: ""   # vault-backed
prov_smartproxy_verify_ssl: true
```

## Example playbook

```yaml
- name: Deploy dnsmasq provisioning server
  hosts: provisioning_servers
  vars:
    prov_action: baseline
    prov_type: dnsmasq
    prov_domain: lab.example.com
    prov_install_execute: true
    prov_dhcp_range_start: "10.0.1.50"
    prov_dhcp_range_end: "10.0.1.150"
    prov_dhcp_gateway: "10.0.1.1"
    prov_dns_upstream:
      - 10.0.1.1
  roles:
    - role: provisioning_services
```

```yaml
- name: Deploy Satellite Smart Proxy
  hosts: capsule_servers
  vars:
    prov_action: baseline
    prov_type: satellite_proxy
    prov_domain: example.com
    prov_install_execute: true
    prov_smartproxy_url: https://satellite.example.com
    prov_smartproxy_username: admin
    prov_smartproxy_password: "{{ vault_satellite_password }}"
  roles:
    - role: provisioning_services
```

## Molecule scenarios

| Scenario | What it tests |
|---|---|
| `default` | Dispatcher validation + type var loading + negative tests |
| `dnsmasq` | dnsmasq install dry-run on RHEL9 UBI |

## Tags

- `provisioning_services` — all tasks
- `provisioning_services-install` — install phase
- `provisioning_services-configure` — configuration phase

## CI

```bash
bash bin/provisioning-services-ci.sh
```

Phase toggles: `PROV_DO_LINT=false`, `PROV_DO_SECRETS=false`, `PROV_DO_MOLECULE=false`

On macOS (run via Podman Machine):

```bash
podman machine ssh "cd '$PWD' && bash bin/provisioning-services-ci.sh"
```

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9/ubi:latest | All dispatcher + dry-run tests pass |

**Scenario: default** — validates dispatcher routing and variable loading for provisioning types without a real PXE/DNS server:

| Test | What is verified |
|---|---|
| `baseline` (dnsmasq, no-op) | `prov_type: dnsmasq` vars loaded; apply flags false; completes cleanly |
| `baseline` (cobbler, no-op) | `prov_type: cobbler` vars loaded; apply flags false; completes cleanly |
| `baseline` (foreman_proxy, no-op) | `prov_type: foreman_proxy` vars loaded; apply flags false; completes cleanly |
| `install` (dnsmasq, dry-run) | `prov_install_execute: false` skips dnsmasq package install; task logic exercised |
| Dispatcher rejects invalid `prov_action` | `bogus_action` raises assertion error (caught in rescue block) |
| Dispatcher rejects invalid `prov_type` | `bogus_type` raises assertion error (caught in rescue block) |

Full deployment (dnsmasq PXE+DHCP+DNS, Cobbler provisioning server, Foreman/Satellite smart proxy) requires a target with RHEL/Rocky repos and network access for TFTP/PXE booting.
