# ingress_default

## Description

Configures the container platform's **built-in ingress controller**. On k3s the built-in
controller is Traefik, managed here through a `HelmChartConfig` in `kube-system`; on other
platforms (which ship their own ingress) the role only verifies and reports status without
managing any manifest or Helm chart.

This is a **product role** (one of the ingress backends: `ingress_default`, `ingress_nginx`,
`ingress_traefik`, `ingress_haproxy`). It is **standalone-first** — runnable on its own in a
playbook — and is also **selected by the `container_platform` dispatcher** when
`cp_ingress_type: default`. Every ingress backend consumes the **same variable interface**
(`action`, `cp_ingress_*`, `cp_kubeconfig_path`, `cp_type`), so the dispatcher selects any of
them with one identical call and no per-backend code.

## Requirements

- Ansible: 2.15+ · Collection: `kubernetes.core` (k8s + k8s_info modules)
- A reachable Kubernetes/k3s cluster and a kubeconfig (`cp_kubeconfig_path`)
- On k3s: the built-in Traefik `HelmChart` present (default k3s install)

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `ingress` | `ingress` (verify/report) · `present` (apply built-in config) · `absent` (remove). Shared across all ingress backends; the dispatcher passes it in. |
| `cp_kubeconfig_path` | `/etc/rancher/k3s/k3s.yaml` | Path to the cluster kubeconfig. Shared interface var. |
| `cp_type` | `k3s` | Platform type. `k3s` manages built-in Traefik; others get a status report. Shared interface var. |
| `cp_ingress_domain` | `""` | Apps/ingress base domain, used in status reporting. Shared interface var. |
| `cp_ingress_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the node/cluster. |
| `_cp_builtin_ingress_name` | `traefik` | Name of the built-in ingress controller deployment queried for status. |

## Use Cases

**Standalone — apply built-in ingress config on a k3s cluster:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: ingress_default
      vars:
        action: present
        cp_kubeconfig_path: /etc/rancher/k3s/k3s.yaml
```

**Standalone — verify built-in ingress status:**

```yaml
- hosts: k8s_cluster
  roles:
    - role: ingress_default
      vars: { action: ingress }
```

**Via the `container_platform` dispatcher** (same code selects any backend):

```yaml
- hosts: k8s_cluster
  roles:
    - role: container_platform
      vars:
        cp_action: ingress
        cp_type: k3s
        cp_ingress_type: default
```

## Testing

```bash
cd roles/ingress_default && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_ingress_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live Kubernetes cluster. A real ingress deployment requires an actual
cluster and is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9 control node; any conformant Kubernetes cluster (validated on k3s).
License: MIT.

## Related Information

- Depth doc: [`docs/ingress_default.md`](../../docs/ingress_default.md) — internals,
  configure/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-ingress.md`](../../docs/container-ingress.md) — the ingress
  backend family and the shared `cp_ingress_*` interface.
- Sibling backends: `ingress_nginx`, `ingress_traefik`, `ingress_haproxy`.
- Dispatcher: `container_platform` (`cp_ingress_type`).
