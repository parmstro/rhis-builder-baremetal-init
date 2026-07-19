import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertActionCloseButton,
  Badge,
  Button,
  Modal,
  Spinner,
  Tab,
  Tabs,
  TabTitleText,
} from '@patternfly/react-core';
import { api, setToken, getToken, setUnauthorizedHandler, setClaimingSession } from './api.js';
import WelcomeCard     from './WelcomeCard.jsx';
import SiteView        from './SiteView.jsx';
import ComponentsView  from './ComponentsView.jsx';
import SOEView         from './SOEView.jsx';
import ReviewView      from './ReviewView.jsx';

const HEARTBEAT_MS = 30_000;

export default function App() {
  const [activeTab, setActiveTab]               = useState('site');
  const [alert, setAlert]                       = useState(null);

  // 'init' | 'active' | 'locked' | 'revoked'
  const [sessionStatus, setSessionStatus]       = useState('init');

  const [catalog, setCatalog]                   = useState([]);
  const [siteConfig, setSiteConfig]             = useState({});
  const [componentsConfig, setComponentsConfig] = useState({});
  const [soeSelections, setSoeSelections]       = useState([]);

  const heartbeatRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function clearLocalState() {
    setSiteConfig({});
    setComponentsConfig({});
    setSoeSelections([]);
  }

  async function loadData() {
    const [catalogRes, deploymentRes] = await Promise.all([
      api.getCatalog(),
      api.getDeployment(),
    ]);
    setCatalog(catalogRes.entries ?? []);
    setSiteConfig(deploymentRes.site_config ?? {});
    setComponentsConfig(deploymentRes.components_config ?? {});
    setSoeSelections(deploymentRes.soe_selections ?? []);
  }

  function startHeartbeat() {
    clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      try {
        await api.sessionHeartbeat();
      } catch (err) {
        if (err.status === 401) {
          // Session was stolen — local state is already stale, backend data was cleared
          clearInterval(heartbeatRef.current);
          setToken(null);
          clearLocalState();
          setSessionStatus('revoked');
        }
      }
    }, HEARTBEAT_MS);
  }

  function activateSession(token) {
    setToken(token);
    startHeartbeat();
    setSessionStatus('active');
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────

  // Register the 401 handler — any mid-session 401 (save, export, etc.) is treated
  // the same as a failed heartbeat: the session was stolen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearInterval(heartbeatRef.current);
      setToken(null);
      clearLocalState();
      setSessionStatus('revoked');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setClaimingSession(true);
      try {
        // If we have a stored token, try to reconnect first.
        const existing = getToken();
        if (existing) {
          try {
            const { token } = await api.sessionClaim();
            if (cancelled) return;
            setToken(token);
            await loadData();
            if (cancelled) return;
            activateSession(token);
            return;
          } catch {
            if (cancelled) return;
            setToken(null); // stale or rejected — fall through to fresh claim
          }
        }

        // Fresh claim.
        try {
          const { token } = await api.sessionClaim();
          if (cancelled) return;
          setToken(token);
          await loadData();
          if (cancelled) return;
          activateSession(token);
        } catch (err) {
          if (cancelled) return;
          if (err.status === 423) {
            setSessionStatus('locked');
          } else {
            setAlert({ variant: 'danger', title: 'Backend unreachable', body: err.message });
            setSessionStatus('active'); // degrade gracefully, show the UI anyway
          }
        }
      } finally {
        if (!cancelled) setClaimingSession(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      setClaimingSession(false);
      clearInterval(heartbeatRef.current);
      // Best-effort release on unmount (tab close / navigation away)
      api.sessionRelease().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Steal handler ─────────────────────────────────────────────────────────

  const handleSteal = useCallback(async () => {
    setClaimingSession(true);
    try {
      const { token } = await api.sessionSteal();
      setToken(token);
      await loadData(); // data was cleared by steal — loads defaults
      activateSession(token);
      setAlert({ variant: 'warning', title: 'Session taken over — deployment data has been reset' });
    } catch (err) {
      setAlert({ variant: 'danger', title: 'Take-over failed', body: err.message });
    } finally {
      setClaimingSession(false);
    }
  }, []);

  // ── Persistence helpers ───────────────────────────────────────────────────

  const handleSiteChange = useCallback(async (data) => {
    setSiteConfig(data);
    try { await api.saveSite(data); } catch (err) {
      setAlert({ variant: 'warning', title: 'Site config not saved', body: err.message });
    }
  }, []);

  const handleComponentsChange = useCallback(async (data) => {
    setComponentsConfig(data);
    try { await api.saveComponents(data); } catch (err) {
      setAlert({ variant: 'warning', title: 'Components config not saved', body: err.message });
    }
  }, []);

  const handleSoeSelectionsChange = useCallback(async (data) => {
    setSoeSelections(data);
    try { await api.saveSoeSelections(data); } catch (err) {
      setAlert({ variant: 'warning', title: 'SOE selections not saved', body: err.message });
    }
  }, []);

  // ── Load existing deployment ──────────────────────────────────────────────

  const handleLoadDeployment = useCallback(async (data) => {
    const site       = data.site_config       ?? {};
    const components = data.components_config ?? {};
    const soe        = data.soe_selections    ?? [];

    setSiteConfig(site);
    setComponentsConfig(components);
    setSoeSelections(soe);

    try {
      await Promise.all([
        api.saveSite(site),
        api.saveComponents(components),
        api.saveSoeSelections(soe),
      ]);
    } catch (err) {
      setAlert({ variant: 'warning', title: 'Load saved but not persisted to session', body: err.message });
      return;
    }

    if (data.source === 'partial') {
      setAlert({
        variant: 'warning',
        title: 'Partial load — SOE selections only',
        body: 'No ui_session.yml found. Site and component settings must be re-entered.',
      });
    } else {
      const domain = site.basevars_global_domain_name ?? '';
      setAlert({ variant: 'success', title: `Loaded: ${domain}` });
    }
    setActiveTab('site');
  }, []);

  // ── Export / Reset ────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    try {
      const result = await api.exportDeployment();
      if (result.written) {
        setAlert({ variant: 'success', title: `Configuration written to ${result.path}` });
      } else {
        for (const [filename, content] of Object.entries(result.files ?? {})) {
          const blob = new Blob([content], { type: 'text/yaml' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href     = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        }
        setAlert({ variant: 'success', title: 'Configuration files downloaded' });
      }
    } catch (err) {
      setAlert({ variant: 'danger', title: 'Export failed', body: err.message });
    }
  }, []);

  const handleReset = useCallback(async () => {
    if (!window.confirm('Reset all deployment configuration? This cannot be undone.')) return;
    try {
      await api.resetDeployment();
      const fresh = await api.getDeployment();
      setSiteConfig(fresh.site_config ?? {});
      setComponentsConfig(fresh.components_config ?? {});
      setSoeSelections(fresh.soe_selections ?? []);
      setAlert({ variant: 'info', title: 'Deployment configuration reset' });
      setActiveTab('site');
    } catch (err) {
      setAlert({ variant: 'danger', title: 'Reset failed', body: err.message });
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedCount = soeSelections.length;
  const domain        = siteConfig.basevars_global_domain_name ?? '';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{
        background: '#151515',
        color: '#fff',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>RHIS Builder</span>
        <span style={{ color: '#8a8d90', fontSize: '0.875rem' }}>
          Deployment configuration
          {domain && <> — <strong style={{ color: '#f0f0f0' }}>{domain}</strong></>}
        </span>
      </div>

      <div style={{ padding: '1.5rem' }}>

        {/* Session locked — blocking overlay */}
        <Modal
          isOpen={sessionStatus === 'locked'}
          variant="small"
          title="Session in use"
          aria-label="Session in use"
          actions={[
            <Button key="steal" variant="danger" onClick={handleSteal}>
              Take over (resets deployment data)
            </Button>
          ]}
        >
          <p>Another operator has an active session on this deployment tool.</p>
          <p style={{ marginTop: '0.75rem' }}>
            Taking over will <strong>reset all deployment data</strong> — the previous
            operator's configuration will be permanently cleared.
          </p>
        </Modal>

        {/* Session revoked — inline alert with reclaim button */}
        {sessionStatus === 'revoked' && (
          <Alert
            variant="danger"
            title="Your session was taken over"
            style={{ marginBottom: '1rem' }}
            actionLinks={
              <Button variant="link" onClick={async () => {
                setClaimingSession(true);
                try {
                  const { token } = await api.sessionClaim();
                  setToken(token);
                  await loadData();
                  activateSession(token);
                } catch (err) {
                  if (err.status === 423) setSessionStatus('locked');
                  else setAlert({ variant: 'danger', title: 'Claim failed', body: err.message });
                } finally {
                  setClaimingSession(false);
                }
              }}>
                Claim a new session
              </Button>
            }
          >
            All deployment data has been cleared by the operator who took over.
          </Alert>
        )}

        {alert && (
          <Alert
            variant={alert.variant}
            title={alert.title}
            actionClose={<AlertActionCloseButton onClose={() => setAlert(null)} />}
            style={{ marginBottom: '1rem' }}
          >
            {alert.body}
          </Alert>
        )}

        {sessionStatus === 'init' ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}><Spinner /></div>
        ) : sessionStatus !== 'revoked' && (
          <>
            {!domain && (
              <WelcomeCard onLoad={handleLoadDeployment} />
            )}
          <Tabs
            activeKey={activeTab}
            onSelect={(_, key) => setActiveTab(key)}
            style={{ marginBottom: '1.5rem' }}
          >
            <Tab eventKey="site" title={<TabTitleText>Site</TabTitleText>}>
              <SiteView
                config={siteConfig}
                onChange={handleSiteChange}
                onNext={() => setActiveTab('components')}
              />
            </Tab>

            <Tab eventKey="components" title={<TabTitleText>Components</TabTitleText>}>
              <ComponentsView
                config={componentsConfig}
                onChange={handleComponentsChange}
                onNext={() => setActiveTab('soe')}
              />
            </Tab>

            <Tab
              eventKey="soe"
              title={
                <TabTitleText>
                  SOE Templates{' '}
                  <Badge isRead style={{ marginLeft: '0.25rem' }}>{selectedCount}</Badge>
                </TabTitleText>
              }
            >
              <SOEView
                catalog={catalog}
                selections={soeSelections}
                onChange={handleSoeSelectionsChange}
                onNext={() => setActiveTab('review')}
                onAlert={setAlert}
              />
            </Tab>

            <Tab
              eventKey="review"
              title={
                <TabTitleText>
                  Review + Export{' '}
                  {selectedCount > 0 && (
                    <Badge isRead style={{ marginLeft: '0.25rem' }}>{selectedCount} SOE</Badge>
                  )}
                </TabTitleText>
              }
            >
              <ReviewView
                siteConfig={siteConfig}
                componentsConfig={componentsConfig}
                soeSelections={soeSelections}
                catalog={catalog}
                onExport={handleExport}
                onReset={handleReset}
              />
            </Tab>
          </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
