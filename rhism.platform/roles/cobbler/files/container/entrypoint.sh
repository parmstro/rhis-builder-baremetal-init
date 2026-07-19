#!/usr/bin/env bash
# cobbler factory entrypoint — explicit converge marker (image-factory
# standard), never config heuristics. An unconverged substrate idles for the
# role's converge; only a role-converged container starts the real daemons.
# No systemd in-container.
#
# DAEMON ORDER MATTERS: cobblerd writes the XML-RPC shared secret
# (/var/lib/cobbler/web.ss) at startup; httpd's mod_wsgi cobbler_api proxy must
# start AFTER cobblerd so it reads the current secret — start httpd first and
# every `cobbler` CLI call fails 'login failed'. cobblerd backgrounds; httpd is
# the foreground PID.
set -euo pipefail

if [ -f /.factory-converged ]; then
  /usr/bin/cobblerd -F &
  for _ in $(seq 1 30); do
    (exec 3<>/dev/tcp/127.0.0.1/25151) 2>/dev/null && break
    sleep 1
  done
  exec /usr/sbin/httpd -DFOREGROUND
fi

# Unconverged substrate: idle awaiting the role's converge.
exec sleep infinity
