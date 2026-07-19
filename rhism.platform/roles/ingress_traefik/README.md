# ingress_traefik

## Description

Deploys or configures the [Traefik](https://traefik.io/traefik/) ingress controller. On k3s
(where Traefik is the built-in controller) it tunes the existing install through a
`HelmChartConfig`; on other platforms it deploys Traefik fresh via Helm and sets it as the
default `IngressClass`. Traefik suits clusters that want CRD-based routing (`IngressRoute`),
automatic service discovery, and Let's Encrypt integration.

This is a **product role** (one of the ingress backends: `ingress_default`, `ingress_nginx`,
`ingress_traefik`, `ingress_haproxy`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `container_platform` dispatcher** when
`cp_ingress_type: traefik`. Every ingress backend consumes the **same variable interface**
(`action`, `cp_ingress_*`, `cp_kubeconfig_path`, `cp_type`), so the dispatcher selects any of
them with one identical call and no per-backend code.

## Requirements

- Ansible: 2.15+ · Collection: `kubernetes.core` (Helm + k8s modules)
- A reachable Kubernetes/k3s cluster and a kubeconfig (`cp_kubeconfig_path`)
- On non-k3s: a `LoadBalancer` provider for the controller Service
- `helm` available to the controller (provided by `kubernetes.core`)

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `ingress` | `ingress` (deploy/configure) · `present` (alias) · `absent` (remove). Shared across all ingress backends; the dispatcher passes it in. |
| `cp_kubeconfig_path` | `/etc/rancher/k3s/k3s.yaml` | Path to the cluster kubeconfig. Shared interface var. |
| `cp_type` | `k3s` | Platform type. `k3s` tunes built-in Traefik via `HelmChartConfig`; others deploy via Helm. Shared interface var. |
| `cp_ingress_replicas` | `1` | Traefik controller replica count. Shared interface var. |
| `cp_ingress_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the node/cluster. |

## Use Cases

**Standalone — configure built-in Traefik on a k3s cluster:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: ingress_traefik
      vars:
        action: ingress
        cp_type: k3s
        cp_ingress_replicas: 2
```

**Standalone — remove Traefik:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: ingress_traefik
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
        cp_ingress_type: traefik
        cp_ingress_replicas: 2
```

## Testing

```bash
cd roles/ingress_traefik && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_ingress_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live Kubernetes cluster. A real Traefik deployment requires an actual
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

- Depth doc: [`docs/ingress_traefik.md`](../../docs/ingress_traefik.md) — internals,
  deploy/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-ingress.md`](../../docs/container-ingress.md) — the ingress
  backend family and the shared `cp_ingress_*` interface.
- Sibling backends: `ingress_default`, `ingress_nginx`, `ingress_haproxy`.
- Dispatcher: `container_platform` (`cp_ingress_type`).
