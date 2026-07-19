import React from 'react';
import {
  ActionGroup,
  Button,
  Form,
  FormGroup,
  FormSection,
  NumberInput,
  TextInput,
  Title,
} from '@patternfly/react-core';

const ROLES = [
  { key: 'satellite',     label: 'Satellite',             min: 1, max: 1 },
  { key: 'capsule',       label: 'Capsule',               min: 0, max: 20 },
  { key: 'idm',          label: 'IdM',                   min: 0, max: 10 },
  { key: 'aapcontroller', label: 'AAP Controller',        min: 0, max: 10 },
  { key: 'aaphub',        label: 'AAP Hub',               min: 0, max: 5  },
  { key: 'quadlet',       label: 'Quadlet host',          min: 0, max: 20 },
];

export default function ComponentsView({ config, onChange, onNext }) {
  const counts = config.rhis_system_count ?? {};

  const setCount = (key, value) => {
    onChange({
      ...config,
      rhis_system_count: { ...counts, [key]: Math.max(0, Number(value)) },
    });
  };

  const set = (key, value) => onChange({ ...config, [key]: value });

  return (
    <div style={{ maxWidth: 800 }}>
      <Title headingLevel="h2" size="xl" style={{ marginBottom: '1.5rem' }}>
        RHIS Components
      </Title>

      <Form>
        <FormSection title="System counts">
          {ROLES.map(({ key, label, min, max }) => (
            <FormGroup key={key} label={label} fieldId={`count-${key}`}>
              <NumberInput
                id={`count-${key}`}
                value={counts[key] ?? 0}
                min={min}
                max={max}
                onMinus={() => setCount(key, (counts[key] ?? 0) - 1)}
                onPlus={() => setCount(key, (counts[key] ?? 0) + 1)}
                onChange={e => setCount(key, e.target.value)}
              />
            </FormGroup>
          ))}
        </FormSection>

        <FormSection title="Release versions">
          <FormGroup label="Satellite release" fieldId="sat-ver">
            <TextInput
              id="sat-ver"
              value={config.rhis_satellite_release_version ?? ''}
              onChange={(_, v) => set('rhis_satellite_release_version', v)}
              placeholder="6.18"
              style={{ maxWidth: 120 }}
            />
          </FormGroup>
          <FormGroup label="Satellite OS major version" fieldId="sat-os">
            <TextInput
              id="sat-os"
              value={config.rhis_satellite_os_major_version ?? ''}
              onChange={(_, v) => set('rhis_satellite_os_major_version', v)}
              placeholder="9"
              style={{ maxWidth: 80 }}
            />
          </FormGroup>
          <FormGroup label="AAP release" fieldId="aap-ver">
            <TextInput
              id="aap-ver"
              value={config.rhis_aap_release_version ?? ''}
              onChange={(_, v) => set('rhis_aap_release_version', v)}
              placeholder="2.6"
              style={{ maxWidth: 120 }}
            />
          </FormGroup>
        </FormSection>

        <FormSection title="Cloud regions (optional)">
          <FormGroup label="AWS region" fieldId="aws">
            <TextInput
              id="aws"
              value={config.rhis_aws_region ?? ''}
              onChange={(_, v) => set('rhis_aws_region', v)}
              placeholder="us-east-2"
            />
          </FormGroup>
          <FormGroup label="Azure region" fieldId="azure">
            <TextInput
              id="azure"
              value={config.rhis_azure_region ?? ''}
              onChange={(_, v) => set('rhis_azure_region', v)}
              placeholder="East US 2"
            />
          </FormGroup>
        </FormSection>

        <ActionGroup>
          <Button variant="primary" onClick={onNext}>
            Next: SOE Templates
          </Button>
        </ActionGroup>
      </Form>
    </div>
  );
}
