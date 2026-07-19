import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  Split,
  SplitItem,
  Title,
} from '@patternfly/react-core';
import { api } from './api.js';

const STEPS = [
  {
    n: 1,
    title: 'Site',
    desc: 'Set the domain name, network defaults, timezone, NTP servers, and deployment type.',
  },
  {
    n: 2,
    title: 'Components',
    desc: 'Choose which RHIS roles to deploy — Satellite, Capsules, IdM, AAP — and their release versions.',
  },
  {
    n: 3,
    title: 'SOE Templates',
    desc: 'Select base OS and layered application SOEs for each architecture you need to support, with kickstart pinning and EUS options.',
  },
  {
    n: 4,
    title: 'Review + Export',
    desc: 'Preview the generated YAML and export to the deployment directory or download the files for rhis-builder-satellite.',
  },
];

export default function WelcomeCard({ onLoad }) {
  const [deployments, setDeployments] = useState([]);
  const [selected, setSelected]       = useState('');
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    api.listDeployments()
      .then(r => setDeployments(r.deployments ?? []))
      .catch(() => {}); // DEPLOYMENT_PATH not set — no saved deployments to show
  }, []);

  async function handleLoad() {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await api.loadDeployment(selected);
      onLoad(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <CardBody>
        <Grid hasGutter>
          {/* ── Workflow overview ── */}
          <GridItem span={deployments.length > 0 ? 8 : 12}>
            <Title headingLevel="h2" size="xl" style={{ marginBottom: '0.5rem' }}>
              Welcome to RHIS Builder
            </Title>
            <p style={{ color: '#6a6e73', marginBottom: '1.25rem' }}>
              Build a deployment configuration in four steps, then export YAML files for
              rhis-builder-satellite.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {STEPS.map(s => (
                <Split key={s.n} hasGutter style={{ alignItems: 'flex-start' }}>
                  <SplitItem>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: '#0066cc', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.875rem', flexShrink: 0,
                    }}>
                      {s.n}
                    </div>
                  </SplitItem>
                  <SplitItem isFilled style={{ paddingTop: 4 }}>
                    <strong>{s.title}</strong>
                    <p style={{ margin: '0.125rem 0 0', color: '#6a6e73', fontSize: '0.875rem' }}>
                      {s.desc}
                    </p>
                  </SplitItem>
                </Split>
              ))}
            </div>
          </GridItem>

          {/* ── Load existing deployment (only shown when DEPLOYMENT_PATH has entries) ── */}
          {deployments.length > 0 && (
            <GridItem span={4}>
              <Card isFlat style={{ background: '#f0f4f8', height: '100%' }}>
                <CardBody>
                  <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                    Load existing deployment
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#6a6e73', marginBottom: '0.75rem' }}>
                    Resume a previously exported configuration. The site, component, and SOE
                    settings will be restored from the saved session.
                  </p>
                  <FormGroup fieldId="load-domain">
                    <FormSelect
                      id="load-domain"
                      value={selected}
                      onChange={(_, v) => setSelected(v)}
                    >
                      <FormSelectOption value="" label="Select a deployment…" isDisabled />
                      {deployments.map(d => (
                        <FormSelectOption key={d} value={d} label={d} />
                      ))}
                    </FormSelect>
                  </FormGroup>
                  <Button
                    variant="primary"
                    style={{ marginTop: '0.75rem' }}
                    isDisabled={!selected || loading}
                    onClick={handleLoad}
                  >
                    {loading ? 'Loading…' : 'Load'}
                  </Button>
                </CardBody>
              </Card>
            </GridItem>
          )}
        </Grid>
      </CardBody>
    </Card>
  );
}
