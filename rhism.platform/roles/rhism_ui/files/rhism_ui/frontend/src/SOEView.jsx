import React, { useState, useMemo } from 'react';
import {
  ActionGroup,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  EmptyStateBody,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Label,
  SearchInput,
  Split,
  SplitItem,
  Switch,
  Tab,
  Tabs,
  TabTitleText,
  Title,
} from '@patternfly/react-core';

// ── Status badge colours ──────────────────────────────────────────────────────

const STATUS_COLOUR = {
  active:       'green',
  partial:      'gold',
  aspirational: 'blue',
  deprecated:   'grey',
};

// ── Arch resolution ───────────────────────────────────────────────────────────

function entryArchs(entry) {
  if (entry.type === 'base') {
    return (entry.os?.architectures ?? []).map(a => a.id);
  }
  return entry.architectures ?? [];
}

// Ordered list of arches present anywhere in the catalog.
function deriveArchTabs(catalog) {
  const ORDER = ['x86_64', 'aarch64', 'ppc64le', 's390x'];
  const seen = new Set(catalog.flatMap(entryArchs));
  return ORDER.filter(a => seen.has(a));
}

// Returns true if this entry should appear in the given arch tab.
// Layered entries with no explicit architectures inherit from their required base.
function entrySupportsArch(entry, arch, catalog) {
  const archs = entryArchs(entry);
  if (archs.length > 0) return archs.includes(arch);
  return (entry.requires ?? []).some(rid => {
    const base = catalog.find(e => e.id === rid);
    return base && entryArchs(base).includes(arch);
  });
}

// ── Dependency helpers ────────────────────────────────────────────────────────

// Returns the ordered list of dependency IDs that are not yet in selectedIds,
// walking the requires chain recursively. Result is base-first so dependencies
// are added before the entries that need them.
function collectRequirements(id, catalog, selectedIds) {
  const result = [];
  const seen = new Set(selectedIds);
  seen.add(id);

  function walk(eid) {
    const e = catalog.find(c => c.id === eid);
    for (const rid of e?.requires ?? []) {
      if (!seen.has(rid)) {
        seen.add(rid);
        walk(rid);       // depth-first: deepest deps come first
        result.push(rid);
      }
    }
  }
  walk(id);
  return result;
}

// ── BundleOptions ─────────────────────────────────────────────────────────────
// Single-arch context — no iteration needed.

function BundleOptions({ entry, arch, options, onChange }) {
  const set = (key, value) => onChange({ ...options, [key]: value });
  const archDef = (entry.os?.architectures ?? []).find(a => a.id === arch);
  const eusAvailable = entry.os?.eus?.available ?? false;

  if (!archDef) return null;

  return (
    <div
      style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #d2d2d2' }}
      onClick={e => e.stopPropagation()}
    >
      <FormGroup label={`${arch} kickstart version`} fieldId={`ks-${entry.id}-${arch}`}
        style={{ marginBottom: '0.5rem' }}>
        <FormSelect
          id={`ks-${entry.id}-${arch}`}
          value={options.kickstart_version ?? archDef.kickstart_default ?? ''}
          onChange={(_, v) => set('kickstart_version', v)}
          style={{ maxWidth: 160 }}
        >
          {(archDef.kickstart_versions ?? [archDef.kickstart_default]).map(ver => (
            <FormSelectOption key={ver} value={ver} label={ver} />
          ))}
        </FormSelect>
      </FormGroup>

      {eusAvailable && (
        <FormGroup label="EUS (Extended Update Support)" fieldId={`eus-${entry.id}-${arch}`}
          style={{ marginBottom: '0.5rem' }}>
          <Switch
            id={`eus-${entry.id}-${arch}`}
            label="EUS enabled"
            labelOff="EUS disabled"
            isChecked={options.eus_enabled ?? false}
            onChange={(_, v) => set('eus_enabled', v)}
          />
          {options.eus_enabled && (
            <FormSelect
              value={options.eus_minor ?? ''}
              onChange={(_, v) => set('eus_minor', v)}
              style={{ maxWidth: 120, marginTop: '0.375rem' }}
            >
              <FormSelectOption value="" label="Select EUS minor…" isDisabled />
              {(entry.os?.eus?.supported_minors ?? []).map(m => (
                <FormSelectOption key={m} value={m} label={m} />
              ))}
            </FormSelect>
          )}
        </FormGroup>
      )}
    </div>
  );
}

// ── BundleCard ────────────────────────────────────────────────────────────────

function BundleCard({ entry, arch, isSelected, isLocked, lockedBy, options, onToggle, onOptionsChange }) {
  const handleInteract = () => {
    if (!isLocked) onToggle(entry.id);
  };

  return (
    <Card
      isSelectable={!isLocked}
      isSelected={isSelected || isLocked}
      onClick={handleInteract}
      style={{ marginBottom: '0.75rem', cursor: isLocked ? 'default' : 'pointer' }}
    >
      <CardHeader>
        <Split hasGutter style={{ width: '100%', alignItems: 'flex-start' }}>
          <SplitItem>
            <Checkbox
              id={`select-${entry.id}-${arch}`}
              isChecked={isSelected || isLocked}
              isDisabled={isLocked}
              onChange={handleInteract}
              onClick={e => e.stopPropagation()}
            />
          </SplitItem>
          <SplitItem isFilled>
            <CardTitle>{entry.name}</CardTitle>
            <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              <Label color={STATUS_COLOUR[entry.status] ?? 'grey'} isCompact>{entry.status}</Label>
              <Label color="purple" isCompact>{entry.type}</Label>
              {(entry.requires ?? []).map(r => (
                <Label key={r} color="orange" isCompact>requires: {r}</Label>
              ))}
              {isLocked && (
                <Label color="blue" isCompact>
                  required by: {[...lockedBy].join(', ')}
                </Label>
              )}
            </div>
          </SplitItem>
        </Split>
      </CardHeader>
      <CardBody>
        <p style={{ fontSize: '0.875rem', color: '#6a6e73', margin: 0 }}>
          {entry.description}
        </p>
        {isSelected && entry.type === 'base' && (
          <BundleOptions
            entry={entry}
            arch={arch}
            options={options ?? {}}
            onChange={onOptionsChange}
          />
        )}
      </CardBody>
    </Card>
  );
}

// ── ArchPanel ─────────────────────────────────────────────────────────────────
// Independent catalog browser + basket for one architecture.

function ArchPanel({ arch, catalog, selections, onSelectionChange, onNext }) {
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch]         = useState('');

  const archSelections = selections.filter(s => s.arch === arch);
  const selectedIds    = new Set(archSelections.map(s => s.id));
  const optionsFor     = id => archSelections.find(s => s.id === id)?.options ?? {};

  // Reverse index: base id → Set of currently-selected layered ids that require it.
  const requiredBy = useMemo(() => {
    const index = {};
    for (const s of archSelections) {
      const e = catalog.find(c => c.id === s.id);
      for (const rid of e?.requires ?? []) {
        if (!index[rid]) index[rid] = new Set();
        index[rid].add(s.id);
      }
    }
    return index;
  }, [archSelections, catalog]);

  const toggle = (id) => {
    const entry = catalog.find(e => e.id === id);
    if (!entry) return;

    if (selectedIds.has(id)) {
      // Locked bases cannot be deselected while dependents remain selected.
      if (requiredBy[id]?.size > 0) return;
      onSelectionChange(selections.filter(s => !(s.id === id && s.arch === arch)));
      return;
    }

    // Auto-select all unsatisfied dependencies (recursive, base-first).
    const depIds = collectRequirements(id, catalog, selectedIds);
    const depsToAdd = depIds.map(rid => {
      const req = catalog.find(e => e.id === rid);
      return { id: rid, arch, options: buildDefaultOptions(req, arch) };
    });

    const defaults = buildDefaultOptions(entry, arch);
    onSelectionChange([...selections, ...depsToAdd, { id, arch, options: defaults }]);
  };

  const setOptions = (id, options) => {
    onSelectionChange(
      selections.map(s => s.id === id && s.arch === arch ? { ...s, options } : s)
    );
  };

  const visible = useMemo(() => {
    const typeOrder = { base: 0, layered: 1, custom: 2 };
    return catalog
      .filter(e => entrySupportsArch(e, arch, catalog))
      .sort((a, b) =>
        (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9) ||
        a.name.localeCompare(b.name)
      )
      .filter(e => {
        if (filterType !== 'all' && e.type !== filterType) return false;
        if (search && !e.name.toLowerCase().includes(search.toLowerCase()) &&
                      !e.id.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
  }, [catalog, arch, filterType, search]);

  const selectedEntries = archSelections
    .map(s => catalog.find(e => e.id === s.id))
    .filter(Boolean);

  return (
    <Split hasGutter style={{ marginTop: '1rem' }}>
      {/* ── Left: catalog browser ── */}
      <SplitItem style={{ flex: '1 1 60%', minWidth: 0 }}>
        <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <SearchInput
            placeholder="Search catalog…"
            value={search}
            onChange={(_, v) => setSearch(v)}
            onClear={() => setSearch('')}
            style={{ flex: '1 1 200px' }}
          />
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {['all', 'base', 'layered'].map(t => (
              <Button
                key={t}
                variant={filterType === t ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilterType(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState>
            <EmptyStateBody>No catalog entries match your filter.</EmptyStateBody>
          </EmptyState>
        ) : (
          visible.map(entry => (
            <BundleCard
              key={entry.id}
              entry={entry}
              arch={arch}
              isSelected={selectedIds.has(entry.id)}
              isLocked={requiredBy[entry.id]?.size > 0}
              lockedBy={requiredBy[entry.id] ?? new Set()}
              options={optionsFor(entry.id)}
              onToggle={toggle}
              onOptionsChange={opts => setOptions(entry.id, opts)}
            />
          ))
        )}
      </SplitItem>

      {/* ── Right: selection basket ── */}
      <SplitItem style={{ flex: '0 0 300px', minWidth: 240 }}>
        <Card>
          <CardHeader>
            <CardTitle>
              Selected ({arch}) <Badge isRead>{archSelections.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardBody>
            {archSelections.length === 0 ? (
              <p style={{ color: '#6a6e73', fontSize: '0.875rem' }}>
                Select one or more catalog entries from the left panel.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {selectedEntries.map(entry => {
                  const locked = requiredBy[entry.id]?.size > 0;
                  return (
                    <li key={entry.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.375rem 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}>
                      <span style={{ fontSize: '0.875rem' }}>{entry.name}</span>
                      {locked ? (
                        <span
                          title={`Required by: ${[...requiredBy[entry.id]].join(', ')}`}
                          aria-label={`Locked — required by: ${[...requiredBy[entry.id]].join(', ')}`}
                          style={{ color: '#6a6e73', padding: '0 0.375rem', cursor: 'help' }}
                        >
                          🔒
                        </span>
                      ) : (
                        <Button
                          variant="plain"
                          size="sm"
                          onClick={() => toggle(entry.id)}
                          aria-label={`Remove ${entry.name}`}
                        >
                          ✕
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <ActionGroup style={{ marginTop: '1rem' }}>
          <Button
            variant="primary"
            isDisabled={selections.length === 0}
            onClick={onNext}
          >
            Next: Review + Export
          </Button>
        </ActionGroup>
      </SplitItem>
    </Split>
  );
}

// ── SOEView ───────────────────────────────────────────────────────────────────

export default function SOEView({ catalog, selections, onChange, onNext, onAlert }) {
  const archTabs = useMemo(() => deriveArchTabs(catalog), [catalog]);
  const [activeTab, setActiveTab] = useState(0);

  if (archTabs.length === 0) {
    return (
      <EmptyState>
        <EmptyStateBody>No catalog entries loaded.</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div>
      <Title headingLevel="h2" size="xl" style={{ marginBottom: '1rem' }}>
        SOE Templates
      </Title>

      <Tabs
        activeKey={activeTab}
        onSelect={(_, k) => setActiveTab(Number(k))}
        isBox
      >
        {archTabs.map((arch, idx) => (
          <Tab key={arch} eventKey={idx} title={<TabTitleText>{arch}</TabTitleText>}>
            <ArchPanel
              arch={arch}
              catalog={catalog}
              selections={selections}
              onSelectionChange={onChange}
              onNext={onNext}
            />
          </Tab>
        ))}
      </Tabs>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaultOptions(entry, arch) {
  if (entry.type !== 'base') return {};
  const archDef = (entry.os?.architectures ?? []).find(a => a.id === arch);
  return {
    kickstart_version: archDef?.kickstart_default ?? '',
    eus_enabled: false,
  };
}
