# Molecule scenario — password_management

Tests the dispatcher routing for all four lifecycle actions (create, audit, rotate, delete)
against the `pm_ansible` backend. The Vault and Thycotic backends are not tested here —
they require external services and are covered in integration tests.

## What is tested

- `create` — generates an ISM-compliant password and writes credential + metadata files
- `audit` — reads metadata and asserts ISM policy compliance
- `rotate` — regenerates password, updates credential file, appends to history
- `delete` — removes credential and metadata files

## Platform

`almalinux:9` — representative of RHEL 9 target hosts; Python 3.11 available for
ISM-compliant password generation (`secrets` module).

## Known boundaries

- Only the `ansible` backend is exercised; `vault` and `thycotic` backends need
  running instances of HashiCorp Vault / Delinea Secret Server to test.
