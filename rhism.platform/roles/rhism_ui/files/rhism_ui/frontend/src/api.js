const BASE = '/api';

// ── Session token ─────────────────────────────────────────────────────────────
// Stored in sessionStorage so a page refresh within the same tab reconnects
// to the existing session rather than fighting for a new claim.

let _token = sessionStorage.getItem('rhis_session_token') ?? null;
let _onUnauthorized = null;
let _claimingSession = false; // suppresses onUnauthorized during claim/init flows

export function setToken(t) {
  _token = t;
  if (t) sessionStorage.setItem('rhis_session_token', t);
  else   sessionStorage.removeItem('rhis_session_token');
}

export function getToken() { return _token; }

// Suppress the unauthorized handler while a claim sequence is in progress.
export function setClaimingSession(v) { _claimingSession = v; }

// App registers this once on mount; called when any request returns 401.
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

// ── Core request ──────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const headers = {};
  if (body)   headers['Content-Type']    = 'application/json';
  if (_token) headers['X-Session-Token'] = _token;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && _onUnauthorized && !_claimingSession) {
    _onUnauthorized();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const e = new Error(err.error ?? res.statusText);
    e.status = res.status;
    e.detail = err;
    throw e;
  }

  return res.json();
}

// ── Public API ────────────────────────────────────────────────────────────────

export const api = {
  // Session management
  sessionStatus:    ()  => request('GET',  '/session/status'),
  sessionClaim:     ()  => request('POST', '/session/claim'),
  sessionHeartbeat: ()  => request('PUT',  '/session/heartbeat'),
  sessionRelease:   ()  => request('POST', '/session/release'),
  sessionSteal:     ()  => request('POST', '/session/steal'),

  // Deployments (saved configurations)
  listDeployments:   ()       => request('GET', '/deployments'),
  loadDeployment:    (domain) => request('GET', `/deployments/${encodeURIComponent(domain)}`),

  // Catalog
  getCatalog:        ()     => request('GET',  '/catalog'),
  getCatalogEntry:   (id)   => request('GET',  `/catalog/${id}`),

  // Deployment session
  getDeployment:     ()     => request('GET',  '/deployment'),
  saveSite:          (data) => request('PUT',  '/deployment/site',          data),
  saveComponents:    (data) => request('PUT',  '/deployment/components',     data),
  saveSoeSelections: (data) => request('PUT',  '/deployment/soe-selections', data),
  resetDeployment:   ()     => request('POST', '/deployment/reset'),
  exportDeployment:  ()     => request('POST', '/deployment/export'),
};
