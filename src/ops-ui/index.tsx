/* ============================================================
   EYES ONLY — Ops UI Entry Point
   Mobile-first field operative check-in interface.
   ============================================================ */

import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { getState, subscribe, init, navigate } from './store';
import { JoinScreen } from './screens/join';
import { DashboardScreen } from './screens/dashboard';
import { EventsScreen } from './screens/events';
import { MapScreen } from './screens/map';

function App() {
  const [state, setState] = useState(getState());

  useEffect(() => {
    init();
    setState(getState());
    return subscribe(() => setState(getState()));
  }, []);

  return (
    <>
      <Header
        actor={state.actor}
        connected={state.wsConnected}
        screen={state.screen}
      />

      {state.screen === 'join' && <JoinScreen />}
      {state.screen === 'dashboard' && <DashboardScreen />}
      {state.screen === 'events' && <EventsScreen />}
      {state.screen === 'map' && <MapScreen />}

      {state.screen !== 'join' && (
        <nav class="nav">
          <button class={state.screen === 'dashboard' ? 'active' : ''} onClick={() => navigate('dashboard')}>
            DASHBOARD
          </button>
          <button class={state.screen === 'events' ? 'active' : ''} onClick={() => navigate('events')}>
            EVENTS
          </button>
          <button class={state.screen === 'map' ? 'active' : ''} onClick={() => navigate('map')}>
            MAP
          </button>
        </nav>
      )}
    </>
  );
}

function Header({ actor, connected, screen }: {
  actor: { callsign: string; team: string } | null;
  connected: boolean;
  screen: string;
}) {
  return (
    <header class="header">
      <h1>EYES ONLY // OPS</h1>
      {actor ? (
        <span class={`status ${connected ? '' : 'offline'}`}>
          {actor.callsign} [{actor.team.toUpperCase()}]
        </span>
      ) : (
        <span class="status offline">OFFLINE</span>
      )}
    </header>
  );
}

const target = document.getElementById('app');
if (target) {
  target.innerHTML = '';

  // Test if Preact render works (SES lockdown can silently break it)
  render(<div id="test-ops">OK</div>, target);
  if (target.children.length === 0) {
    console.warn('[OPS] Preact render broken, falling back to DOM');
    target.innerHTML = '';
    renderOpsWithDOM(target);
  } else {
    target.innerHTML = '';
    render(<App />, target);
  }
}

const OPS_STORAGE_KEY = 'eyesonly_ops_session';

interface OpsSession { token: string; actor: { callsign: string; team: string; scenario_id: number } }

function getOpsSession(): OpsSession | null {
  try { const s = localStorage.getItem(OPS_STORAGE_KEY); if (s) { const d = JSON.parse(s); if (d.token) return d; } } catch {}
  return null;
}

async function opsFetch(path: string, session: OpsSession, opts: RequestInit = {}): Promise<Response> {
  return fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, ...(opts.headers || {}) },
  });
}

function renderOpsWithDOM(container: HTMLElement) {
  const session = getOpsSession();
  if (session) {
    renderOpsDashboard(container, session);
  } else {
    renderOpsJoin(container);
  }
}

function renderOpsJoin(container: HTMLElement) {
  const screen = document.createElement('div');
  screen.className = 'join-screen';
  screen.innerHTML = `
    <div class="logo">EYES ONLY</div>
    <div class="subtitle">FIELD OPERATIVE CHECK-IN</div>
    <div class="field"><label>JOIN CODE</label><input type="text" id="ops-code" placeholder="Enter join code" autocomplete="off" /></div>
    <div class="field"><label>CALLSIGN</label><input type="text" id="ops-callsign" placeholder="Your callsign" autocomplete="off" /></div>
    <div id="ops-error" class="error-msg" style="display:none"></div>
    <button id="ops-btn" class="btn">JOIN OPERATION</button>
  `;
  screen.querySelector('#ops-btn')!.addEventListener('click', async () => {
    const code = (document.getElementById('ops-code') as HTMLInputElement).value;
    const callsign = (document.getElementById('ops-callsign') as HTMLInputElement).value;
    const errEl = document.getElementById('ops-error')!;
    const btn = document.getElementById('ops-btn') as HTMLButtonElement;
    if (!code || !callsign) { errEl.textContent = 'Enter code and callsign'; errEl.style.display = ''; return; }
    btn.textContent = 'JOINING...'; btn.disabled = true; errEl.style.display = 'none';
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, callsign }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as any; throw new Error(d.message || 'Join failed'); }
      const data = await res.json() as any;
      const session: OpsSession = { token: data.token, actor: data.actor };
      localStorage.setItem(OPS_STORAGE_KEY, JSON.stringify(session));
      container.innerHTML = '';
      renderOpsDashboard(container, session);
    } catch (err: any) {
      errEl.textContent = err.message || 'Network error'; errEl.style.display = '';
      btn.textContent = 'JOIN OPERATION'; btn.disabled = false;
    }
  });
  container.appendChild(screen);
}

function renderOpsDashboard(container: HTMLElement, session: OpsSession) {
  container.innerHTML = `
    <header class="header">
      <h1>EYES ONLY // OPS</h1>
      <span class="status">${session.actor.callsign} [${session.actor.team.toUpperCase()}]</span>
    </header>
    <div class="screen" id="ops-screen">
      <div class="stat-row">
        <div class="card"><h2>STATUS</h2><div class="value" style="color:var(--accent);">ACTIVE</div></div>
        <div class="card"><h2>TEAM</h2><div class="value">${session.actor.team.toUpperCase()}</div></div>
      </div>
      <div class="card"><h2>RECENT EVENTS</h2><div id="ops-events" style="max-height:300px;overflow-y:auto;">Loading...</div></div>
      <div class="card">
        <h2>CHECK-IN</h2>
        <div class="field"><label>LANE</label><input type="text" id="ops-checkin-lane" placeholder="Lane ID" /></div>
        <div class="field"><label>MESSAGE</label><input type="text" id="ops-checkin-msg" placeholder="Status update" /></div>
        <button class="btn" id="ops-checkin-btn" style="margin-top:8px;">CHECK IN</button>
      </div>
      <button class="btn danger" id="ops-disconnect" style="margin-top:auto;">DISCONNECT</button>
    </div>
  `;

  // Load events
  loadOpsEvents(session);
  setInterval(() => loadOpsEvents(session), 10000);

  // Check-in handler
  document.getElementById('ops-checkin-btn')!.addEventListener('click', async () => {
    const lane = (document.getElementById('ops-checkin-lane') as HTMLInputElement).value;
    const msg = (document.getElementById('ops-checkin-msg') as HTMLInputElement).value;
    if (!lane) return;
    await opsFetch('/ops/checkin', session, { method: 'POST', body: JSON.stringify({ lane_id: lane, message: msg }) });
    (document.getElementById('ops-checkin-msg') as HTMLInputElement).value = '';
    loadOpsEvents(session);
  });

  // Disconnect
  document.getElementById('ops-disconnect')!.addEventListener('click', () => {
    localStorage.removeItem(OPS_STORAGE_KEY);
    container.innerHTML = '';
    renderOpsJoin(container);
  });
}

async function loadOpsEvents(session: OpsSession) {
  try {
    const res = await opsFetch('/ops/events', session);
    if (!res.ok) return;
    const data = await res.json() as any;
    const events = data.events || [];
    const el = document.getElementById('ops-events');
    if (!el) return;
    if (events.length === 0) { el.innerHTML = '<div style="color:var(--text-dim);">No events yet.</div>'; return; }
    el.innerHTML = events.slice(-20).reverse().map((ev: any) => {
      const ts = new Date(ev.created_at).toLocaleTimeString();
      return `<div style="padding:3px 0;border-bottom:1px solid var(--border);font-size:12px;"><span style="color:var(--text-dim);font-size:10px;">${ts}</span> <strong>${ev.event_type}</strong></div>`;
    }).join('');
  } catch {}
}
