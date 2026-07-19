# Credits

## rhism.platform builds on RHIS — thank you, Paul Armstrong (parmstro)

This collection builds directly on **RHIS — the Red Hat Infrastructure Standard**
(RH-ISAM, Red Hat Infrastructure Standard Adoption Model) — created and maintained by
**Paul Armstrong ([@parmstro](https://github.com/parmstro))**.

Everything here traces back to his work: the opinionated reference toolkit for
standing up and running a complete **governed RHEL management estate** (IdM,
Satellite + capsules, AAP controller + hub, KVM hypervisors, NBDE/Tang, test hosts),
the **SOE catalogue** model, and the **estate-manifest UI**. The standard — the vision
of a repeatable, governed way to build and run a RHEL estate — is his.

### Upstream source (with our sincere thanks)

- [`github.com/parmstro/rhis-builder-inventory`](https://github.com/parmstro/rhis-builder-inventory) — the SOE catalogue + builder
- [`github.com/parmstro/rhis-provisioner-container`](https://github.com/parmstro/rhis-provisioner-container) — the provisioner container
- [`github.com/parmstro/rhis-builder-ui`](https://github.com/parmstro/rhis-builder-ui) — the estate-manifest web UI

### What rhism contributes

rhism **aligns RHIS with current versions** (AAP 2.5/2.7, current certified
collections, current RHEL) and **integrates additional capabilities** on top of the
same standard: a manifest-driven wizard → builder → deployer flow, discrete
action-driven roles composed via the inventory, dual-mode (ansible-core *or*
AAP-governed) execution, a per-product/selectable-engine monitoring model, GitOps
Config-as-Code, and a **proven full gated day-1 build convergence** on a real AAP/AWX
control plane. The standard and the vision are Paul's; this is that standard aligned
to current versions with additional integrations, offered back with gratitude.

### License

RHIS's upstream `LICENSE` is retained (see the vendored provenance); this collection
is MIT. If any of this is useful back upstream, it is offered with thanks — a
contribution to RHIS, not a replacement for it.
