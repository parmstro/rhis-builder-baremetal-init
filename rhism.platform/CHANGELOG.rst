==============================
rhism.platform Release Notes
==============================

.. contents:: Topics

Unreleased
==========

Minor Changes
-------------

- New role ``rhism_inventory`` — the SOE catalogue owner
  (``validate | aggregate | generate | publish``): schema-validates SOE
  build definitions, aggregates any selection into the flat deduplicated
  input set the ``satellite`` role consumes (including one
  ``content_soe_bundles`` bundle per activation key with the promotion-path
  prior derived from lifecycle-environment order, plus the
  ``content_presync_sources`` sync gate), generates deployment content
  (full-CIDR network derivations correct at any prefix length, ``0700``
  vault skeleton, aggregated SOE chain) from a wizard manifest or direct
  vars, and publishes the catalogue in the ``rhism_ui`` ``CATALOG_PATH``
  contract. Ships a provenance-recorded reference catalogue (RHEL 9/10
  entries). Tier-2 functional molecule green; depth doc at
  ``docs/rhism_inventory.md``.

Bugfixes
--------

- ``builder`` — the KVM ``configure`` dispatch is gated on
  ``pb_deploy_execute`` so a dry-run on an EE without ``community.libvirt``
  no longer aborts at play load (load-time module resolution precedes any
  ``when:`` gate).

v1.0.0
======

Release Summary
---------------

First release of ``rhism.platform`` as a **fully self-contained,
self-branded collection**. Rebranded from the earlier private-namespace
identity: the namespace/collection is now ``rhism.platform`` and **no live
legacy-namespace FQCN remains inside the collection** — every role resolves
as ``rhism.platform.<name>``.

Major Changes
-------------

- **Rebrand**: the earlier private-namespace identity → ``rhism.platform``
  (namespace ``rhism``, collection ``platform``). Every intra-collection
  FQCN updated accordingly. This is a breaking change for any consumer
  that referenced the old pre-rebrand FQCNs.
- **Full self-containment**: every role the ``builder`` can dispatch to is
  now vendored in-collection — the estate-profile components plus all
  optional day-2 dispatchers (secrets/password management, mail, SCM,
  backup, container platform, monitoring) and their product-sibling roles.
  The collection no longer declares any external collection dependency
  (``dependencies: {}``); ``requirements.yml`` removed.
- **``builder_ui`` renamed to ``rhism_ui``** — the security-hardened fork of
  RHIS's web UI now carries rhism's own name (``rhism.platform.rhism_ui``);
  its image is ``localhost/rhism-ui``.

Included Roles
--------------

- ``wizard`` — interactive estate wizard (TUI + pre-baked ``estate``
  profile), real S/M/L estate sizing tiers.
- ``builder`` — dependency-ordered estate orchestrator.
- ``rhism_ui`` — security-hardened web UI for building an estate manifest
  (built from source; loopback-only; real authentication).
- Estate component roles: ``identity_management`` (+ ``rh_idm``),
  ``content_management`` (+ ``satellite``), ``provisioning_services`` (+
  ``satellite_proxy``, ``cobbler``), ``tang``, and the ``linux_security``
  family (``linux_packages``/``linux_hardening``/``firewall``/
  ``linux_auditing``/``linux_users``/``linux_selinux``).
- Optional day-2 component roles: ``password_management`` (+ ``pm_ansible``/
  ``pm_vault``/``pm_thycotic``), ``mail_server`` (+ ``mail_relay``/
  ``mail_full``), ``scm_deploy`` (+ ``gitlab_ce``/``gitlab_ee``),
  ``backup_management`` (+ ``restic``/``bareos``), ``container_platform``
  (+ ``ocp``/``okd``/``k3s``/``rke2``, ``ingress_*``, ``storage_*``,
  ``registry_internal``/``registry_generic``), ``monitoring_stack``.

Known Follow-ups (in progress this release cycle)
-------------------------------------------------

- ``rhism_inventory`` — a new SOE-catalogue role (resolves an
  SOE-bundle catalogue into clean keyed-group vars; replaces the upstream
  34k-line host_vars fan-out).
- ``rhism_container`` — an all-in-one appliance image (control node + bundled
  UI) built via the image factory.
- Wiring AAP + KVM/hypervisor deploy steps into ``builder`` (the estate
  profile enables both; the dispatch steps are being added).
