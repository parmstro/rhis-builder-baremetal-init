# ingress_nginx

## Description

Deploys the [NGINX ingress controller](https://kubernetes.github.io/ingress-nginx/) on a
Kubernetes cluster via Helm and sets it as the default `IngressClass`. NGINX is the most
widely used ingress controller — a good general-purpose choice for clusters that do not ship
their own (K3s/RKE2) and need broad annotation/feature compatibility.

This is a **product role** (one of the ingress backends: `ingress_default`, `ingress_nginx`,
`ingress_traefik`, `ingress_haproxy`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `container_platform` dispatcher** when
`cp_ingress_type: nginx`. Every ingress backend consumes the **same variable interface**
(`action`, `cp_ingress_*`, `cp_kubeconfig_path`), so the dispatcher selects any of them with
one identical call and no per-backend code.

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
| `cp_ingress_replicas` | `1` | NGINX controller replica count. Shared interface var. |
| `cp_ingress_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the node/cluster. |
| `cp_ingress_ssl_passthrough` | `false` | Enable NGINX SSL passthrough support. |

## Use Cases

**Standalone — deploy NGINX ingress onto an existing cluster:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: ingress_nginx
      vars:
        action: ingress
        cp_kubeconfig_path: /etc/rancher/k3s/k3s.yaml
        cp_ingress_replicas: 2
```

**Standalone — remove NGINX ingress:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: ingress_nginx
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
        cp_ingress_type: nginx
        cp_ingress_replicas: 2
```

## Testing

```bash
cd roles/ingress_nginx && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_ingress_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live Kubernetes cluster. A real NGINX deployment requires an actual cluster
and is exercised in the full-stack test lab, not in molecule.

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

- Depth doc: [`docs/ingress_nginx.md`](../../docs/ingress_nginx.md) — internals,
  deploy/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-ingress.md`](../../docs/container-ingress.md) — the ingress
  backend family and the shared `cp_ingress_*` interface.
- Sibling backends: `ingress_default`, `ingress_traefik`, `ingress_haproxy`.
- Dispatcher: `container_platform` (`cp_ingress_type`).
