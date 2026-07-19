import express from 'express';
import cors from 'cors';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from './logger.js';
import { validate } from './session-lock.js';
import sessionRouter     from './routes/session.js';
import catalogRouter     from './routes/catalog.js';
import deploymentRouter  from './routes/deployment.js';
import deploymentsRouter from './routes/deployments.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';

const app = express();

// Restricted CORS — added by rhism (see ../SECURITY-REVIEW.md
// "Compounding factor — wide-open CORS"). The original app.use(cors())
// set Access-Control-Allow-Origin: * for every response, which combined
// with the unauthenticated /api/session/steal (now fixed in auth.js) was
// a drive-by CSRF-class data-wipe: any page a victim's browser loaded
// could silently call this API. In production the frontend is served
// same-origin (see the static-serving branch below), so CORS is not
// needed there at all — default to disabled (`false`) and only enable a
// specific origin for local dev via RHISM_UI_ALLOWED_ORIGIN.
const allowedOrigin = process.env.RHISM_UI_ALLOWED_ORIGIN || false;
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.url });
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({ service: 'rhis-builder-ui', status: 'ok', version: '0.1.0' });
});

// Session endpoints are public — no token required.
app.use('/api/session', sessionRouter);

// All other API routes require a valid session token.
function requireSession(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!validate(token)) {
    return res.status(401).json({
      error: 'Session required',
      code:  'SESSION_REQUIRED',
    });
  }
  next();
}

app.use('/api/catalog',     requireSession, catalogRouter);
app.use('/api/deployment',  requireSession, deploymentRouter);
app.use('/api/deployments', requireSession, deploymentsRouter);

if (!isDev) {
  const publicDir = join(__dirname, '../../frontend/dist');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => res.sendFile(join(publicDir, 'index.html')));
}

app.use((err, _req, res, _next) => {
  logger.error({ err: err.message }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
