import { Router } from 'express';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getKey, setKey, clearSession } from '../db.js';
import { toYaml, assertSafeSegment, assertWithinBase, UnsafePathError } from '../utils.js';
import logger from '../logger.js';

const DEPLOYMENT_PATH = process.env.DEPLOYMENT_PATH ?? null;

const router = Router();

function defaultSite() {
  return {
    rhis_timezone: 'America/Toronto',
    rhis_locale: 'en',
    rhis_time_servers: [
      '0.rhel.pool.ntp.org',
      '1.rhel.pool.ntp.org',
      '2.rhel.pool.ntp.org',
      '3.rhel.pool.ntp.org',
    ],
    basevars_disconnected_domain: false,
  };
}

// ── Session state keys ────────────────────────────────────────────────────────
// site_config       — global deployment parameters (domain, network, timezone…)
// components_config — rhis_system_count + release versions + cloud region flags
// soe_selections    — array of { id, options } for each selected catalog entry

// GET /api/deployment — return full current session state
router.get('/', (_req, res) => {
  res.json({
    site_config:       getKey('site_config')       ?? defaultSite(),
    components_config: getKey('components_config') ?? defaultComponents(),
    soe_selections:    getKey('soe_selections')    ?? [],
  });
});

// PUT /api/deployment/site
router.put('/site', (req, res) => {
  setKey('site_config', req.body);
  res.json({ ok: true });
});

// PUT /api/deployment/components
router.put('/components', (req, res) => {
  setKey('components_config', req.body);
  res.json({ ok: true });
});

// PUT /api/deployment/soe-selections
router.put('/soe-selections', (req, res) => {
  setKey('soe_selections', req.body);
  res.json({ ok: true });
});

// POST /api/deployment/reset — wipe session and start fresh
router.post('/reset', (_req, res) => {
  clearSession();
  res.json({ ok: true });
});

// POST /api/deployment/export — render and optionally write the output files
router.post('/export', async (req, res) => {
  const site       = getKey('site_config')       ?? {};
  const components = getKey('components_config') ?? defaultComponents();
  const selections = getKey('soe_selections')    ?? [];

  const basevars = buildInventoryBasevars(site, components);
  const soeSelections = buildSoeSelections(selections);

  const basevarsYaml    = toYaml(basevars);
  const selectionsYaml  = toYaml(soeSelections);

  // Write to deployment directory when DEPLOYMENT_PATH + domain are configured
  const domain = site.basevars_global_domain_name;
  if (DEPLOYMENT_PATH && domain) {
    try {
      assertSafeSegment(domain, 'domain'); // fixed: was join()'d with zero validation
      const deployDir = join(DEPLOYMENT_PATH, domain);
      assertWithinBase(deployDir, DEPLOYMENT_PATH, 'deployment directory');
      await mkdir(deployDir, { recursive: true });
      await writeFile(join(deployDir, 'inventory_basevars.yml'), basevarsYaml, 'utf8');
      await writeFile(join(deployDir, 'soe_selections.yml'), selectionsYaml, 'utf8');
      // ui_session.yml preserves the raw session structure for exact round-trip loading.
      await writeFile(join(deployDir, 'ui_session.yml'),
        toYaml({ site_config: site, components_config: components, soe_selections: selections }),
        'utf8');
      logger.info({ domain, deployDir }, 'Exported deployment configuration');
      res.json({ ok: true, written: true, path: deployDir });
    } catch (err) {
      if (err instanceof UnsafePathError) {
        logger.warn({ domain, err: err.message }, 'Rejected unsafe domain value');
        return res.status(400).json({ error: 'Invalid domain value', detail: err.message });
      }
      logger.error({ err: err.message }, 'Failed to write deployment files');
      res.status(500).json({ error: 'Failed to write files', detail: err.message });
    }
  } else {
    // Return file contents for browser download
    res.json({
      ok: true,
      written: false,
      files: {
        'inventory_basevars.yml': basevarsYaml,
        'soe_selections.yml':     selectionsYaml,
      },
    });
  }
});

// ── Builders ─────────────────────────────────────────────────────────────────

function defaultComponents() {
  return {
    rhis_system_count: {
      satellite:      1,
      capsule:        0,
      idm:            2,
      aapcontroller:  1,
      aaphub:         1,
      quadlet:        0,
    },
    rhis_satellite_release_version: '6.19',
    rhis_aap_release_version:       '2.6',
  };
}

function buildInventoryBasevars(site, components) {
  return {
    ...site,
    ...components,
  };
}

function buildSoeSelections(selections) {
  return {
    soe_selections: selections.map(s => ({
      id: s.id,
      ...(s.options ?? {}),
    })),
  };
}

export default router;
