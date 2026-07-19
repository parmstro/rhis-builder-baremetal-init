import app from './app.js';
import logger from './logger.js';

const PORT = Number(process.env.PORT ?? 3001);

// Loopback-only by default — added by rhism (owner rule: this UI must
// always be restricted to only the machine it runs on). The original
// app.listen(PORT, ...) with no host argument binds to 0.0.0.0 (all
// interfaces) by Node's own default.
//
// Two different deployment shapes need two different answers here:
// - Run directly on a host (no container): default to 127.0.0.1 — genuinely
//   loopback-only, nothing else can reach it.
// - Run inside a container (the normal case, via run_container.sh /
//   the Ansible role's podman-based deploy): the app must bind to 0.0.0.0
//   *inside its own isolated container network namespace* — podman's port
//   forwarding delivers traffic to the container's internal interface, not
//   its loopback, so binding to 127.0.0.1 in-container would silently break
//   the port publish entirely. run_container.sh explicitly sets HOST=0.0.0.0
//   for this reason. The REAL host-reachability boundary in the container
//   case is podman's own publish binding — `-p 127.0.0.1:$port:$port` in
//   run_container.sh (also fixed) restricts which HOST interface the port
//   is exposed on, which is what actually keeps this off the network.
const HOST = process.env.HOST ?? '127.0.0.1';

app.listen(PORT, HOST, () => {
  logger.info({ host: HOST, port: PORT }, 'rhis-builder-ui backend started (loopback-only)');
});
