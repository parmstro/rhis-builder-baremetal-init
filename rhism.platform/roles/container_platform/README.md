# rhism.platform.container_platform

Deploy and configure Kubernetes and OpenShift container platforms — K3s, RKE2, OKD, and OCP — with unified storage, registry, and ingress management.

## Description

`container_platform` provides a single dispatcher interface for deploying four container platform distributions across RHEL/CentOS 8–9 hosts. Each distribution is modelled as a type (`cp_type`) with type-specific variables driving package names, service names, install scripts, and feature flags. A dry-run gate (`cp_install_execute: false`) ensures no cluster is deployed until explicitly enabled.

The role covers the full lifecycle: binary installation, cluster configuration, storage class provisioning (local-path, NFS, Longhorn, OCS/ODF), private registry mirroring, and ingress controller deployment.

## Actions

| Action | Description |
|--------|-------------|
| `install` | Install the platform binary/packages and bootstrap the cluster |
| `configure` | Deploy cluster config file and set KUBECONFIG for root |
| `storage` | Configure a StorageClass (local-path, NFS, Longhorn, OCS) |
| `registry` | Configure internal or mirror container registry |
| `ingress` | Deploy or report on ingress controller (default/nginx/traefik/haproxy) |
| `baseline` | Orchestrator — runs install → configure → storage → registry → ingress via boolean toggles |

## Types

| Type | Description | Subscription |
|------|-------------|--------------|
| `k3s` | Lightweight Kubernetes (Rancher) — single-binary install via `get.k3s.io` | None |
| `rke2` | Rancher Government Kubernetes — FIPS-capable, STIG-aligned | None |
| `okd` | OpenShift Origin (community) — IPI installer flow | None |
| `ocp` | Red Hat OpenShift Container Platform — IPI installer with pull-secret | RHSM + pull-secret required |

## Requirements

- RHEL/CentOS 8 or 9
- Privilege escalation (`become: true`)
- Collections: `ansible.posix`, `community.general`, `kubernetes.core`
- OCP only: valid `cp_pull_secret` (Red Hat pull secret from console.redhat.com) and RHSM credentials

## Key Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `cp_action` | `baseline` | Action to run |
| `cp_type` | `k3s` | Platform type |
| `cp_install_execute` | `false` | Dry-run gate; set true to actually install |
| `cp_node_role` | `control_plane` | Node role: `control_plane` or `worker` |
| `cp_cluster_name` | `cluster` | Cluster name (used in ingress domain) |
| `cp_base_domain` | `example.local` | Base domain for cluster |
| `cp_install_version` | `""` | Version to pin (empty = latest) |
| `cp_tls_san` | `[]` | Additional TLS SANs for API server cert |
| `cp_server_url` | `""` | Control plane URL (workers only) |
| `cp_node_token` | `""` | Cluster join token (vault-backed) |
| `cp_ocp_version` | `4.16` | OCP/OKD version to install |
| `cp_pull_secret` | `""` | OCP pull secret (vault-backed) |
| `cp_ssh_pub_key` | `""` | SSH public key injected into cluster nodes |
| `cp_install_dir` | `/opt/openshift-install` | OCP/OKD install working directory |
| `cp_rhsm_org_id` | `""` | RHSM org ID (OCP only) |
| `cp_rhsm_activation_key` | `""` | RHSM activation key (OCP only) |
| `cp_rhsm_skip_registration` | `false` | Skip RHSM registration |
| `cp_storage_type` | `local-path` | Storage backend: `local-path`, `nfs`, `longhorn`, `ocs` |
| `cp_storage_nfs_server` | `""` | NFS server hostname (NFS storage only) |
| `cp_storage_nfs_path` | `/exports` | NFS export path |
| `cp_registry_type` | `internal` | Registry type: `internal`, `generic` |
| `cp_registry_url` | `""` | Registry URL for mirror configuration |
| `cp_ingress_type` | `default` | Ingress type: `default`, `nginx`, `traefik`, `haproxy` |
| `cp_apply_install` | `false` | Baseline toggle: run install |
| `cp_apply_configure` | `false` | Baseline toggle: run configure |
| `cp_apply_storage` | `false` | Baseline toggle: run storage |
| `cp_apply_registry` | `false` | Baseline toggle: run registry |
| `cp_apply_ingress` | `false` | Baseline toggle: run ingress |

## Example Playbooks

### K3s control plane (dry-run)

```yaml
- hosts: k8s_nodes
  roles:
    - role: container_platform
      vars:
        cp_action: install
        cp_type: k3s
        cp_node_role: control_plane
        cp_install_execute: false  # set true to actually install
```

### OCP install (dry-run)

```yaml
- hosts: bastion
  roles:
    - role: container_platform
      vars:
        cp_action: install
        cp_type: ocp
        cp_install_execute: false  # set true to actually install
        cp_ocp_version: "4.16"
        cp_cluster_name: prod
        cp_base_domain: example.com
        cp_ssh_pub_key: "{{ lookup('file', '~/.ssh/id_rsa.pub') }}"
        cp_pull_secret: "{{ vault_ocp_pull_secret }}"
        cp_rhsm_org_id: "{{ vault_rhsm_org_id }}"
        cp_rhsm_activation_key: "{{ vault_rhsm_activation_key }}"
```

### Full k3s baseline

```yaml
- hosts: k8s_nodes
  roles:
    - role: container_platform
      vars:
        cp_action: baseline
        cp_type: k3s
        cp_install_execute: true
        cp_apply_install: true
        cp_apply_configure: true
        cp_apply_storage: true
        cp_storage_type: local-path
        cp_apply_ingress: true
        cp_ingress_type: default
```

## Molecule Test Scenarios

**default** — dispatcher validation, type var loading, and dry-run installs. No cluster required.

- k3s, rke2, okd, ocp baseline no-ops (all toggles off)
- k3s install dry-run
- ocp install dry-run (with required vars provided)
- Negative: invalid `cp_action` → assert rejected
- Negative: invalid `cp_type` → assert rejected

## CI

```bash
# macOS Silicon (run inside Podman Machine VM)
podman machine ssh "cd '$PWD' && bash bin/container-platform-ci.sh"

# Skip molecule (lint + secrets only)
CP_DO_MOLECULE=false bash bin/container-platform-ci.sh

# Force EE rebuild
EE_FORCE=true bash bin/container-platform-ci.sh
```

EE image: `ansible_galaxy_cp_ee:latest`

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9/ubi:latest | All dispatcher + variable loading tests pass |

**Scenario: default** — validates dispatcher routing and type variable loading for all 4 platform types without a real cluster:

| Test | What is verified |
|---|---|
| `baseline` (k3s, no-op) | `cp_type: k3s` vars loaded; all apply flags false; completes cleanly |
| `baseline` (rke2, no-op) | `cp_type: rke2` vars loaded; all apply flags false; completes cleanly |
| `baseline` (okd, no-op) | `cp_type: okd` vars loaded; all apply flags false; completes cleanly |
| `baseline` (ocp, no-op) | `cp_type: ocp` vars loaded; RHSM skip flag respected; completes cleanly |
| Dispatcher rejects invalid `cp_action` | `bogus_action` raises assertion error (caught in rescue block) |
| Dispatcher rejects invalid `cp_type` | `bogus_type` raises assertion error (caught in rescue block) |

Actual cluster deployment (K3s install, RKE2 cluster bootstrap, OKD/OCP IPI) requires target hosts with network access to image registries and sufficient resources.
