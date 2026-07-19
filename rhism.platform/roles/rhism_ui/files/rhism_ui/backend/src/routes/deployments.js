import { Router } from 'express';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fromYaml, assertSafeSegment, assertWithinBase } from '../utils.js';
import logger from '../logger.js';

const DEPLOYMENT_PATH = process.env.DEPLOYMENT_PATH ?? null;

const router = Router();

// GET /api/deployments — list domains that have an soe_selections.yml
router.get('/', async (_req, res) => {
  if (!DEPLOYMENT_PATH || !existsSync(DEPLOYMENT_PATH)) {
    return res.json({ deployments: [], deployment_path: DEPLOYMENT_PATH });
  }
  try {
    const entries = await readdir(DEPLOYMENT_PATH, { withFileTypes: true });
    const deployments = entries
      .filter(e => e.isDirectory() &&
                   existsSync(join(DEPLOYMENT_PATH, e.name, 'soe_selections.yml')))
      .map(e => e.name)
      .sort();
    res.json({ deployments, deployment_path: DEPLOYMENT_PATH });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to list deployments');
    res.status(500).json({ error: 'Failed to list deployments', detail: err.message });
  }
});

// GET /api/deployments/:domain — load a saved deployment's session state
router.get('/:domain', async (req, res) => {
  if (!DEPLOYMENT_PATH) {
    return res.status(503).json({ error: 'DEPLOYMENT_PATH not configured' });
  }
  const { domain } = req.params;
  try {
    assertSafeSegment(domain, 'domain'); // fixed: was join()'d with zero validation
  } catch (err) {
    logger.warn({ domain, err: err.message }, 'Rejected unsafe domain value');
    return res.status(400).json({ error: 'Invalid domain value', detail: err.message });
  }
  const deployDir = join(DEPLOYMENT_PATH, domain);
  assertWithinBase(deployDir, DEPLOYMENT_PATH, 'deployment directory');

  // Prefer ui_session.yml — written by this tool for exact round-trip
  const uiSessionPath = join(deployDir, 'ui_session.yml');
  if (existsSync(uiSessionPath)) {
    try {
      const raw = await readFile(uiSessionPath, 'utf8');
      const s   = fromYaml(raw);
      return res.json({
        source:            'ui_session',
        site_config:       s.site_config       ?? {},
        components_config: s.components_config ?? {},
        soe_selections:    s.soe_selections    ?? [],
      });
    } catch (err) {
      logger.warn({ domain, err: err.message }, 'ui_session.yml unreadable, falling back');
    }
  }

  // Fallback: soe_selections.yml only (hand-crafted or pre-ui deployment)
  const selectionsPath = join(deployDir, 'soe_selections.yml');
  if (existsSync(selectionsPath)) {
    try {
      const raw    = await readFile(selectionsPath, 'utf8');
      const parsed = fromYaml(raw);
      return res.json({
        source:            'partial',
        site_config:       {},
        components_config: {},
        soe_selections:    parsed.soe_selections ?? [],
      });
    } catch (err) {
      logger.error({ domain, err: err.message }, 'Failed to parse soe_selections.yml');
      return res.status(500).json({ error: 'Failed to load deployment', detail: err.message });
    }
  }

  res.status(404).json({ error: 'Deployment not found' });
});

export default router;
