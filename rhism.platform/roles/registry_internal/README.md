# registry_internal

## Description

Enables and exposes the **platform built-in container registry**. On OpenShift
(`cp_type: ocp`/`okd`) it turns on the OpenShift image-registry operator, exposes its
default route, and provisions a `registry-sa` service account bound to `registry-editor`
for push/pull — then reports the route host and token. On k3s/rke2, which have no built-in
registry, it defers to `registry_generic`.

This is a **product role** (one of the registry backends: `registry_internal`,
`registry_generic`). It is **standalone-first** — runnable on its own in a playbook — and is
also **selected by the `container_platform` dispatcher** when `cp_registry_type: internal`.
Both registry backends consume the **same variable interface** (`action`, `cp_registry_*`,
`cp_kubeconfig_path`, `cp_type`), so the dispatcher selects either with one identical call
and no per-backend code.

## Requirements

- Ansible: 2.15+ · Collection: `kubernetes.core` (k8s + k8s_info modules)
- OCP/OKD: a reachable OpenShift cluster and a kubeconfig/oc context with cluster-admin
  (the role creates cluster-scoped resources: the image-registry Config and a ClusterRoleBinding)
- k3s/rke2: no built-in registry — this backend defers to `registry_generic`

## Role Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `action` | `registry` | `registry` (enable) · `present` (alias) · `absent` (remove). Shared across all registry backends; the dispatcher passes it in. |
| `cp_type` | `k3s` | Platform selector — `ocp`/`okd` use the built-in registry; `k3s`/`rke2` defer to `registry_generic`. Shared interface var. |
| `cp_kubeconfig_path` | `/etc/rancher/k3s/k3s.yaml` | Path to the cluster kubeconfig (or oc kubeconfig). Shared interface var. |
| `cp_registry_execute` | `true` | Dry-run gate honoured by every backend — set `false` to validate dispatch + variables without changing the node/cluster. |
| `cp_registry_namespace` | `openshift-image-registry` | Namespace of the platform built-in registry. |
| `cp_registry_url` | `""` | External registry endpoint (read by `registry_generic`; part of the shared interface). |

## Use Cases

**Standalone — enable the OpenShift built-in registry:**

```yaml
- hosts: ocp_bootstrap
  roles:
    - role: registry_internal
      vars:
        action: registry
        cp_type: ocp
        cp_kubeconfig_path: /root/.kube/config
```

**Standalone — remove the built-in registry:**

```yaml
- hosts: ocp_bootstrap
  roles:
    - role: registry_internal
      vars: { action: absent, cp_type: ocp }
```

**Via the `container_platform` dispatcher** (same code selects either backend):

```yaml
- hosts: ocp_bootstrap
  roles:
    - role: container_platform
      vars:
        cp_action: registry
        cp_type: ocp
        cp_registry_type: internal
```

## Testing

```bash
cd roles/registry_internal && molecule test   # standalone, independent of any dispatcher
```

The `default` scenario runs the role on its own with `cp_registry_execute: false`, so it
validates action dispatch, the shared variable contract, and the negative (bad-action) path
without needing a live OpenShift cluster. A real registry enablement requires an actual
cluster and is exercised in the full-stack test lab, not in molecule.

### Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | ubi9 | Pass (2026-07-01) |

### Bugfixes

_None yet — populated as scenarios are brought green._

## Support / License

Platforms: EL9 control node; any conformant OpenShift (OCP/OKD) cluster. License: MIT.

## Related Information

- Depth doc: [`docs/registry_internal.md`](../../docs/registry_internal.md) — internals,
  enable/teardown workflow, permutations, and gotchas.
- Family index: [`docs/container-registry.md`](../../docs/container-registry.md) — the registry
  backend family and the shared `cp_*` interface.
- Sibling backend: `registry_generic`.
- Dispatcher: `container_platform` (`cp_registry_type`).
