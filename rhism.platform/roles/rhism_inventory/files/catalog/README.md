# Bundled SOE reference catalogue

One `*.yml` file per SOE catalogue entry, each following the SOE bundle model
schema (§3.1 of the upstream `schema/soe_bundle_model.md` design proposal):
`name`, optional `lifecycle_state` (`active|deprecated|experimental`),
`content:{repository_sets, custom_products, content_views}`,
`templates:{provisioning_templates, partition_tables, snippets[{priority,name}]}`,
`lifecycle:{lifecycle_environments, activation_keys, hostgroups}`, and
`infrastructure_refs:{compute_resource, subnet, domain, realm}` —
infrastructure refs are assertions against existing site infra, never created
by a bundle (§3.3).

## Provenance

Object names (repository sets, content views, activation keys, hostgroups,
snippet names/priorities) are derived from the upstream
`rhis-builder-inventory` snapshot:

- Upstream: `github.com/parmstro/rhis-builder-inventory` (author parmstro),
  `refs/heads/main` zip snapshot, downloaded 2026-07-14 — full provenance in
  `roles/rhism/PROVENANCE.md` of the orchestration repo.
- Source files: `inventory_template/host_vars/satellite/{repository_sets,
  content_views, activation_keys, hostgroups, lifecycle_environments}.yml`
  and `schema/soe_snippet_ordering_rfc.md` (priority phase ranges).
- These are **trimmed reference entries** — representative real Red Hat
  object names at a readable size, not the full multi-thousand-line upstream
  lists. Site examples use `soe.example.com` placeholders.

No secret-like values appear in any entry — secrets travel outside generated
trees (see the role README's generate action notes).
