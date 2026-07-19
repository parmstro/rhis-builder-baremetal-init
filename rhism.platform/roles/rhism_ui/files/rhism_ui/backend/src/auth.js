import { timingSafeEqual } from 'node:crypto';

// Real authentication for the session-claim boundary — added by rhism
// (see ../SECURITY-REVIEW.md "CRITICAL — no real authentication, by design").
// The original app has NO credential anywhere: POST /api/session/claim and
// POST /api/session/steal took zero input, so "requires a session token"
// downstream was not a real access-control boundary — anyone reachable on
// the network could get a valid token in one request.
//
// Fix: claim/steal now require a shared secret (RHISM_UI_ADMIN_SECRET, no
// default — fails closed) presented via the X-Admin-Secret header, checked
// with a constant-time comparison to avoid a timing side-channel. This
// keeps the app's own single-trusted-operator design intent (a lightweight
// shared secret, not a full user/password system) while closing the
// drive-by CSRF-class hole: a malicious page loaded in a victim's browser
// cannot know the secret, so it cannot silently claim or steal a session.
//
// Reconnect (an already-valid x-session-token) deliberately does NOT
// require re-presenting the secret — holding a valid token is itself proof
// of a prior successful authentication.

const ADMIN_SECRET = process.env.RHISM_UI_ADMIN_SECRET ?? '';

export function adminSecretConfigured() {
  return ADMIN_SECRET.length > 0;
}

export function verifyAdminSecret(presented) {
  if (!adminSecretConfigured()) return false; // fail closed — never treat an unset secret as "no auth needed"
  if (typeof presented !== 'string' || presented.length === 0) return false;

  const expected = Buffer.from(ADMIN_SECRET, 'utf8');
  const actual = Buffer.from(presented, 'utf8');
  if (expected.length !== actual.length) return false; // timingSafeEqual requires equal-length buffers
  return timingSafeEqual(expected, actual);
}

// Express middleware: reject with 401 unless a valid X-Admin-Secret is presented.
export function requireAdminSecret(req, res, next) {
  if (!adminSecretConfigured()) {
    return res.status(503).json({
      error: 'Server misconfigured',
      code: 'ADMIN_SECRET_NOT_CONFIGURED',
      message: 'RHISM_UI_ADMIN_SECRET is not set — refusing to allow session claim/steal with no way to authenticate the caller.',
    });
  }
  if (!verifyAdminSecret(req.headers['x-admin-secret'])) {
    return res.status(401).json({
      error: 'Invalid or missing admin secret',
      code: 'ADMIN_SECRET_REQUIRED',
    });
  }
  next();
}
