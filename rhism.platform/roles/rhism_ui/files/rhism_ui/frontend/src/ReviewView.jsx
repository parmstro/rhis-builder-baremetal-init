import React from 'react';
import {
  ActionGroup,
  Button,
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Label,
  Split,
  SplitItem,
  Title,
} from '@patternfly/react-core';

// ── Helpers ───────────────────────────────────────────────────────────────────

function YamlBlock({ content }) {
  return (
    <pre style={{
      background: '#1e1e1e',
      color: '#d4d4d4',
      padding: '1rem',
      borderRadius: 4,
      fontSize: '0.8125rem',
      overflowX: 'auto',
      margin: 0,
    }}>
      {content}
    </pre>
  );
}

function soeSelectionsYaml(selections, catalog) {
  if (selections.length === 0) return 'soe_selections: []';
  const lines = ['soe_selections:'];
  for (const sel of selections) {
    const entry = catalog.find(e => e.id === sel.id);
    lines.push(`  - id: ${sel.id}`);
    if (sel.arch) lines.push(`    arch: ${sel.arch}`);
    if (entry)    lines.push(`    # ${entry.name}`);
    const opts = sel.options ?? {};
    for (const [k, v] of Object.entries(opts)) {
      if (v !== null && v !== undefined && v !== '') {
        lines.push(`    ${k}: ${JSON.stringify(v)}`);
      }
    }
  }
  return lines.join('\n');
}

function inventoryBasevarsYaml(site, components) {
  const lines = ['---'];
  const combined = { ...site, ...components };
  for (const [k, v] of Object.entries(combined)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const [sk, sv] of Object.entries(v)) {
        lines.push(`  ${sk}: ${JSON.stringify(sv)}`);
      }
    } else if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  return lines.join('\n');
}

// ── Disk estimator ────────────────────────────────────────────────────────────

function computeDiskEstimate(selections, catalog) {
  const byArch = {};
  let hasEus = false;

  for (const sel of selections) {
    const entry = catalog.find(e => e.id === sel.id);
    if (!entry || !sel.arch) continue;

    const base  = entry.disk_estimate_gb?.[sel.arch] ?? 0;
    let   extra = 0;

    if (sel.options?.eus_enabled) {
      extra = entry.eus_minor_estimate_gb?.[sel.arch] ?? 0;
      if (extra > 0) hasEus = true;
    }

    byArch[sel.arch] = (byArch[sel.arch] ?? 0) + base + extra;
  }

  const total = Object.values(byArch).reduce((a, b) => a + b, 0);
  return { byArch, total, hasEus };
}

function DiskEstimateCard({ soeSelections, catalog }) {
  const { byArch, total, hasEus } = computeDiskEstimate(soeSelections, catalog);
  const archs = Object.keys(byArch).sort();

  return (
    <Card>
      <CardTitle>Estimated Satellite disk (sync footprint)</CardTitle>
      <CardBody>
        {archs.length === 0 ? (
          <p style={{ color: '#6a6e73', fontSize: '0.875rem', margin: 0 }}>
            No SOE templates selected.
          </p>
        ) : (
          <>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', borderBottom: '1px solid #d2d2d2' }}>Architecture</th>
                  <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', borderBottom: '1px solid #d2d2d2' }}>Sync footprint</th>
                </tr>
              </thead>
              <tbody>
                {archs.map(arch => (
                  <tr key={arch}>
                    <td style={{ padding: '0.25rem 0.5rem', fontFamily: 'monospace' }}>{arch}</td>
                    <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>~{byArch[arch]} GB</td>
                  </tr>
                ))}
                {archs.length > 1 && (
                  <tr style={{ borderTop: '1px solid #d2d2d2', fontWeight: 600 }}>
                    <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                    <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>~{total} GB</td>
                  </tr>
                )}
              </tbody>
            </table>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: '#6a6e73' }}>
              <li>Sync footprint is stored under <code>/var/lib/pulp</code> on Satellite.</li>
              <li>Keeping multiple CV versions across dev→prod typically adds 1.5–2× overhead.</li>
              {hasEus && <li>EUS minor repo included in estimate; each additional pinned minor adds the same amount again.</li>}
              <li>Values are approximate; actual usage varies with package churn between syncs.</li>
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ── ReviewView ────────────────────────────────────────────────────────────────

export default function ReviewView({
  siteConfig, componentsConfig, soeSelections, catalog, onExport, onReset,
}) {
  const domain      = siteConfig.basevars_global_domain_name ?? '(not set)';
  const counts      = componentsConfig.rhis_system_count ?? {};
  const activeRoles = Object.entries(counts).filter(([, n]) => n > 0);

  return (
    <div>
      <Title headingLevel="h2" size="xl" style={{ marginBottom: '1.5rem' }}>
        Review + Export
      </Title>

      <Split hasGutter style={{ marginBottom: '1.5rem' }}>
        <SplitItem isFilled>
          <Card>
            <CardTitle>Deployment summary</CardTitle>
            <CardBody>
              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>Domain</DescriptionListTerm>
                  <DescriptionListDescription>{domain}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Components</DescriptionListTerm>
                  <DescriptionListDescription>
                    {activeRoles.length === 0
                      ? '—'
                      : activeRoles.map(([r, n]) => `${r} ×${n}`).join(', ')}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>SOE templates</DescriptionListTerm>
                  <DescriptionListDescription>
                    {soeSelections.length === 0 ? '—' : (
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {soeSelections.map(sel => {
                          const entry = catalog.find(e => e.id === sel.id);
                          if (!entry) return null;
                          return (
                            <Label key={`${sel.id}-${sel.arch}`} isCompact>
                              {entry.name}{sel.arch ? ` (${sel.arch})` : ''}
                            </Label>
                          );
                        })}
                      </div>
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </CardBody>
          </Card>
        </SplitItem>
        <SplitItem isFilled>
          <DiskEstimateCard soeSelections={soeSelections} catalog={catalog} />
        </SplitItem>
      </Split>

      <Split hasGutter>
        <SplitItem isFilled>
          <Card style={{ marginBottom: '1rem' }}>
            <CardTitle>inventory_basevars.yml</CardTitle>
            <CardBody style={{ padding: 0 }}>
              <YamlBlock content={inventoryBasevarsYaml(siteConfig, componentsConfig)} />
            </CardBody>
          </Card>
        </SplitItem>
        <SplitItem isFilled>
          <Card style={{ marginBottom: '1rem' }}>
            <CardTitle>soe_selections.yml</CardTitle>
            <CardBody style={{ padding: 0 }}>
              <YamlBlock content={soeSelectionsYaml(soeSelections, catalog)} />
            </CardBody>
          </Card>
        </SplitItem>
      </Split>

      <ActionGroup>
        <Button variant="primary" onClick={onExport}>
          Export
        </Button>
        <Button variant="link" isDanger onClick={onReset}>
          Reset deployment
        </Button>
      </ActionGroup>
    </div>
  );
}
