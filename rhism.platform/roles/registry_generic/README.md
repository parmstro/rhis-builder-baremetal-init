# registry_generic

## Description

Configures an **external container registry** for a Kubernetes cluster. It creates a
`kubernetes.io/dockerconfigjson` pull secret in the `default` namespace and points the cluster
at the registry: on k3s/rke2 it writes a containerd `registries.yaml` mirror (with optional
auth); on OCP/OKD it optionally adds the registry to the cluster `Image` config
`allowedRegistries`. Works with Harbor, Nexus, Artifactory, a plain Docker registry, or any
OCI-compliant endpoint.

This is a **product role** (one of the registry backends: `registry_internal`,
`registry_generic`). It is **standalone-first** — runnable on its own in a playbook — and is
also **selected by the `container_platform` dispatcher** when `cp_registry_type: generic`.
Both registry backends consume the **same variable interface** (`action`, `cp_registry_*`,
`cp_kubeconfig_path`, `cp_type`), so the dispatcher selects either with one identical call
and no per-backend code.

## Requirements

- Ansible: 2.15+ · Collection: `kubernetes.core` (k8s module)
- A reachable cluster and a kubeconfig (`cp_kubeconfig_path`)
- k3s/rke2: root on the nodes to write `registries.yaml` under `cp_registry_config_dir`
- OCP/OKD (when `cp_registry_trust_cluster: true`): a cluster-admin context to patch `Image/cluster`

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `registry` | `registry` (configure) · `present` (alias) · `absent` (remove). Shared across all registry backends; the dispatcher passes it in. |
| `cp_type` | `k3s` | Platform selector — `k3s`/`rke2` write a containerd mirror; `ocp`/`okd` trust via cluster Image config. Shared interface var. |
| `cp_kubeconfig_path` | `/etc/rancher/k3s/k3s.yaml` | Path to the cluster kubeconfig. Shared interface var. |
| `cp_registry_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the node/cluster. |
| `cp_registry_url` | `""` | External registry endpoint. Required (non-empty) when executing a configure action. |
| `cp_registry_username` | `""` | Registry username (optional — omit for anonymous pull). |
| `cp_registry_password` | `""` | Registry password (optional — omit for anonymous pull). |
| `cp_registry_secret_name` | `registry-pull-secret` | Name of the Kubernetes pull secret created in `default`. |
| `cp_registry_config_dir` | `/etc/rancher/k3s` | Directory for the containerd `registries.yaml` on k3s/rke2. |
| `cp_registry_trust_cluster` | `false` | On OCP/OKD, add the registry to `Image/cluster` `allowedRegistries`. |

## Use Cases

**Standalone — configure a k3s containerd mirror with auth:**

```yaml
- hosts: k3s_cluster
  roles:
    - role: registry_generic
      vars:
        action: registry
        cp_type: k3s
        cp_registry_url: registry.example.com
        cp_registry_username: robot
        cp_registry_password: "{{ vault_registry_password }}"
```

**Standalone — remove the external registry config:**

```yaml
- hosts: k3s_cluster
  roles:
    - role: registry_generic
      vars:
        action: absent
        cp_type: k3s
```

**Via the `container_platform` dispatcher** (same code selects either backend):

```yaml
- hosts: rke2_cluster
  roles:
    - role: container_platform
      vars:
        cp_action: registry
        cp_type: rke2
        cp_registry_type: generic
        cp_registry_url: registry.example.com
```

## Testing

```bash
cd roles/registry_generic && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_registry_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live cluster. A real registry configuration requires an actual cluster and
is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9 control node; any conformant Kubernetes cluster (validated on K3s/RKE2 and
OCP/OKD). License: MIT.

## Related Information

- Depth doc: [`docs/registry_generic.md`](../../docs/registry_generic.md) — internals,
  configure/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-registry.md`](../../docs/container-registry.md) — the registry
  backend family and the shared `cp_*` interface.
- Sibling backend: `registry_internal`.
- Dispatcher: `container_platform` (`cp_registry_type`).
