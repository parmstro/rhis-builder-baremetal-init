#!/usr/bin/env bash
# mail_full factory entrypoint — explicit converge marker, never config
# heuristics (packaged default configs make an unconfigured container look
# configured and start broken daemons mid-converge).
set -euo pipefail

if [ -f /.factory-converged ]; then
  # Role-converged: start the real stack in-container (no systemd).
  postfix start
  exec /usr/sbin/dovecot -F
fi

# Unconverged substrate: idle awaiting the role's converge.
exec sleep infinity
