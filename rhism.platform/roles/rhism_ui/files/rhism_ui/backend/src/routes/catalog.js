import { Router } from 'express';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fromYaml, assertSafeSegment } from '../utils.js';
import logger from '../logger.js';

// Convention: rhis-builder-inventory lives at /home/ansiblerunner/rhis/rhis-builder-inventory.
// Override with CATALOG_PATH env var when launching outside that convention.
const CATALOG_PATH = process.env.CATALOG_PATH ??
  '/home/ansiblerunner/rhis/rhis-builder-inventory/schema/soe_catalog';

if (!existsSync(CATALOG_PATH)) {
  logger.warn({ catalog_path: CATALOG_PATH },
    'CATALOG_PATH does not exist — catalog API will return errors until the path is available');
}

const router = Router();

async function loadCatalog() {
  const files = (await readdir(CATALOG_PATH)).filter(f => f.endsWith('.yml'));
  const entries = await Promise.all(
    files.map(async f => {
      try {
        const raw = await readFile(join(CATALOG_PATH, f), 'utf8');
        return fromYaml(raw);
      } catch (err) {
        logger.warn({ file: f, err: err.message }, 'Failed to parse catalog entry');
        return null;
      }
    })
  );
  return entries.filter(Boolean);
}

// GET /api/catalog
router.get('/', async (_req, res) => {
  try {
    const entries = await loadCatalog();
    res.json({ entries, catalog_path: CATALOG_PATH });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to load catalog');
    res.status(500).json({ error: 'Failed to load catalog', detail: err.message });
  }
});

// GET /api/catalog/:id
router.get('/:id', async (req, res) => {
  try {
    assertSafeSegment(req.params.id, 'catalog id'); // fixed: was join()'d with zero validation
    const raw = await readFile(join(CATALOG_PATH, `${req.params.id}.yml`), 'utf8');
    res.json(fromYaml(raw));
  } catch {
    res.status(404).json({ error: 'Catalog entry not found' });
  }
});

export default router;
