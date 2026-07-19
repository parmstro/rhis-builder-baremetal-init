import React, { useState } from 'react';
import {
  ActionGroup,
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormSection,
  TextInput,
  Title,
} from '@patternfly/react-core';

// ── CIDR ↔ netmask conversion ─────────────────────────────────────────────────

function cidrToNetmask(prefix) {
  const p = parseInt(prefix, 10);
  if (isNaN(p) || p < 0 || p > 32) return '';
  const mask = ~(0xFFFFFFFF >>> p) >>> 0;
  return [
    (mask >>> 24) & 0xFF,
    (mask >>> 16) & 0xFF,
    (mask >>> 8)  & 0xFF,
     mask         & 0xFF,
  ].join('.');
}

function netmaskToCidr(mask) {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(mask)) return '';
  const parts = mask.split('.').map(Number);
  if (parts.some(p => isNaN(p) || p < 0 || p > 255)) return '';
  const binary = parts.map(p => p.toString(2).padStart(8, '0')).join('');
  const m = binary.match(/^(1*)(0*)$/);
  if (!m) return '';
  return String(m[1].length);
}

// ── SiteView ──────────────────────────────────────────────────────────────────

export default function SiteView({ config, onChange, onNext }) {
  // Local draft for the NTP textarea — preserves trailing newlines while typing.
  // null means "use the array from config"; a string means the user is mid-edit.
  const [ntpDraft, setNtpDraft] = useState(null);

  const set = (key, value) => onChange({ ...config, [key]: value });

  function handlePrefixChange(v) {
    const netmask = cidrToNetmask(v);
    onChange({ ...config, default_network_prefix: v, default_network_mask: netmask });
  }

  function handleMaskChange(v) {
    const prefix = netmaskToCidr(v);
    onChange({ ...config, default_network_mask: v, default_network_prefix: prefix });
  }

  const ntpArray = config.rhis_time_servers ?? [];
  const ntpValue = ntpDraft !== null ? ntpDraft : ntpArray.join('\n');

  function handleNtpChange(e) {
    const raw = e.target.value;
    setNtpDraft(raw);
    // Persist parsed array without trailing-blank suppression causing cursor collapse
    onChange({ ...config, rhis_time_servers: raw.split('\n').map(s => s.trim()).filter(Boolean) });
  }

  function handleNtpBlur() {
    setNtpDraft(null);
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <Title headingLevel="h2" size="xl" style={{ marginBottom: '1.5rem' }}>
        Site Configuration
      </Title>

      <Form>
        <FormSection title="Identity">
          <FormGroup label="Domain name" isRequired fieldId="domain">
            <TextInput
              id="domain"
              value={config.basevars_global_domain_name ?? ''}
              onChange={(_, v) => set('basevars_global_domain_name', v)}
              placeholder="example.com"
            />
          </FormGroup>
        </FormSection>

        <FormSection title="Network">
          <FormGroup label="Default network" fieldId="net">
            <TextInput
              id="net"
              value={config.default_network ?? ''}
              onChange={(_, v) => set('default_network', v)}
              placeholder="192.168.100.0"
            />
          </FormGroup>
          <FormGroup label="Prefix" fieldId="prefix">
            <TextInput
              id="prefix"
              value={config.default_network_prefix ?? ''}
              onChange={(_, v) => handlePrefixChange(v)}
              placeholder="24"
            />
          </FormGroup>
          <FormGroup label="Netmask" fieldId="mask">
            <TextInput
              id="mask"
              value={config.default_network_mask ?? ''}
              onChange={(_, v) => handleMaskChange(v)}
              placeholder="255.255.255.0"
            />
          </FormGroup>
        </FormSection>

        <FormSection title="Locale">
          <FormGroup label="Timezone" fieldId="tz">
            <TextInput
              id="tz"
              value={config.rhis_timezone ?? ''}
              onChange={(_, v) => set('rhis_timezone', v)}
              placeholder="America/Toronto"
            />
          </FormGroup>
          <FormGroup label="Locale" fieldId="locale">
            <TextInput
              id="locale"
              value={config.rhis_locale ?? ''}
              onChange={(_, v) => set('rhis_locale', v)}
              placeholder="en"
            />
          </FormGroup>
          <FormGroup label="City" fieldId="city">
            <TextInput
              id="city"
              value={config.rhis_primary_city ?? ''}
              onChange={(_, v) => set('rhis_primary_city', v)}
            />
          </FormGroup>
          <FormGroup label="State / Province" fieldId="state">
            <TextInput
              id="state"
              value={config.rhis_primary_state ?? ''}
              onChange={(_, v) => set('rhis_primary_state', v)}
            />
          </FormGroup>
        </FormSection>

        <FormSection title="NTP servers">
          <FormGroup label="NTP servers (one per line)" fieldId="ntp">
            <textarea
              id="ntp"
              rows={4}
              style={{ width: '100%', fontFamily: 'monospace', padding: '0.375rem' }}
              value={ntpValue}
              onChange={handleNtpChange}
              onBlur={handleNtpBlur}
              placeholder={'0.rhel.pool.ntp.org\n1.rhel.pool.ntp.org'}
            />
          </FormGroup>
        </FormSection>

        <FormSection title="Deployment type">
          <FormGroup fieldId="disconnected">
            <Checkbox
              id="disconnected"
              label="Disconnected (air-gapped) deployment"
              isChecked={config.basevars_disconnected_domain ?? false}
              onChange={(_, v) => set('basevars_disconnected_domain', v)}
            />
          </FormGroup>
        </FormSection>

        <ActionGroup>
          <Button variant="primary" onClick={onNext}>
            Next: Components
          </Button>
        </ActionGroup>
      </Form>
    </div>
  );
}
