import { Router } from 'express';
import { claim, heartbeat, release, steal, status, validate } from '../session-lock.js';
import { clearSession } from '../db.js';
import { requireAdminSecret } from '../auth.js';
import logger from '../logger.js';

const router = Router();

// GET /api/session/status — public (no secret data exposed, safe to leave open)
router.get('/status', (_req, res) => {
  res.json(status());
});

// POST /api/session/claim — take the session if it is free.
// Reconnect (an already-valid x-session-token) skips the admin-secret check —
// see auth.js. A FIRST claim requires the secret.
router.post('/claim', (req, res, next) => {
  const existing = req.headers['x-session-token'];
  if (existing && validate(existing)) {
    heartbeat(existing);
    logger.info('Session reconnected');
    return res.json({ token: existing });
  }
  return requireAdminSecret(req, res, next);
}, (req, res) => {
  const token = claim();
  if (!token) {
    return res.status(423).json({
      error: 'Session in use',
      message: 'Another operator has an active session. Use steal to take over — this resets all deployment data.',
    });
  }
  logger.info('Session claimed');
  res.json({ token });
});

// PUT /api/session/heartbeat — keep session alive; 401 tells the client it was stolen
router.put('/heartbeat', (req, res) => {
  const token = req.headers['x-session-token'];
  if (!heartbeat(token)) {
    return res.status(401).json({ error: 'Session revoked or expired' });
  }
  res.json({ ok: true });
});

// POST /api/session/release — clean shutdown; data is preserved
router.post('/release', (req, res) => {
  const token = req.headers['x-session-token'];
  release(token);
  logger.info('Session released');
  res.json({ ok: true });
});

// POST /api/session/steal — forcibly take the session; clears ALL deployment data.
// Always requires the admin secret — this is the most consequential endpoint in
// the app (wipes all deployment data unconditionally), never left open.
router.post('/steal', requireAdminSecret, (_req, res) => {
  clearSession();
  const token = steal();
  logger.warn('Session stolen — deployment data cleared');
  res.json({ token });
});

export default router;
