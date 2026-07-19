# ingress_haproxy

## Description

Deploys the [HAProxy Kubernetes ingress controller](https://www.haproxy.com/documentation/kubernetes-ingress/)
via Helm and sets it as the default `IngressClass`. On OpenShift (`ocp`/`okd`), where HAProxy
is already the built-in router, the role does not deploy anything and only reports status.
HAProxy suits workloads needing high-performance L4/L7 load balancing and fine-grained TCP
handling.

This is a **product role** (one of the ingress backends: `ingress_default`, `ingress_nginx`,
`ingress_traefik`, `ingress_haproxy`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `container_platform` dispatcher** when
`cp_ingress_type: haproxy`. Every ingress backend consumes the **same variable interface**
(`action`, `cp_ingress_*`, `cp_kubeconfig_path`, `cp_type`), so the dispatcher selects any of
them with one identical call and no per-backend code.

## Requirements

- Ansible: 2.15+ · Collection: `kubernetes.core` (Helm + k8s modules)
- A reachable Kubernetes cluster and a kubeconfig (`cp_kubeconfig_path`)
- A `LoadBalancer` provider (cloud LB, MetalLB, or ServiceLB) for the controller Service
- `helm` available to the controller (provided by `kubernetes.core`)

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `ingress` | `ingress` (deploy) · `present` (alias) · `absent` (remove). Shared across all ingress backends; the dispatcher passes it in. |
| `cp_kubeconfig_path` | `/etc/rancher/k3s/k3s.yaml` | Path to the cluster kubeconfig. Shared interface var. |
| `cp_type` | `k3s` | Platform type. `ocp`/`okd` are status-only (built-in router); others deploy via Helm. Shared interface var. |
| `cp_ingress_domain` | `""` | Apps/ingress base domain, used in status reporting. Shared interface var. |
| `cp_ingress_replicas` | `1` | HAProxy controller replica count. Shared interface var. |
| `cp_ingress_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the node/cluster. |

## Use Cases

**Standalone — deploy HAProxy ingress onto an existing cluster:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: ingress_haproxy
      vars:
        action: ingress
        cp_kubeconfig_path: /etc/rancher/k3s/k3s.yaml
        cp_ingress_replicas: 2
```

**Standalone — remove HAProxy ingress:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: ingress_haproxy
      vars: { action: absent }
```

**Via the `container_platform` dispatcher** (same code selects any backend):

```yaml
- hosts: k8s_cluster
  roles:
    - role: container_platform
      vars:
        cp_action: ingress
        cp_type: k3s
        cp_ingress_type: haproxy
        cp_ingress_replicas: 2
```

## Testing

```bash
cd roles/ingress_haproxy && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_ingress_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live Kubernetes cluster. A real HAProxy deployment requires an actual
cluster and is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9 control node; any conformant Kubernetes cluster (validated on K3s/RKE2).
License: MIT.

## Related Information

- Depth doc: [`docs/ingress_haproxy.md`](../../docs/ingress_haproxy.md) — internals,
  deploy/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-ingress.md`](../../docs/container-ingress.md) — the ingress
  backend family and the shared `cp_ingress_*` interface.
- Sibling backends: `ingress_default`, `ingress_nginx`, `ingress_traefik`.
- Dispatcher: `container_platform` (`cp_ingress_type`).
