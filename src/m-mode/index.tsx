/* ============================================================
   EYES ONLY — M Mode Director Console Entry Point
   3-panel real-time scenario management.
   ============================================================ */

// Diagnostic: confirm bundle entry point executes
console.log('[MMODE] app.js IIFE entered');
(window as any).__MMODE_DIAG?.push?.('bundle-entered');

import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { getState, subscribe, init, login, logout } from './store';
import { GridPanel } from './panels/grid';
import { EventsPanel } from './panels/events';
import { ControlPanel } from './panels/control';

console.log('[MMODE] imports resolved, render =', typeof render);

function App() {
  const [s, setS] = useState(getState());

  useEffect(() => {
    init();
    setS(getState());
    return subscribe(() => setS(getState()));
  }, []);

  if (s.auth === 'login') return <LoginScreen />;

  return (
    <>
      <header class="m-header">
        <h1>M MODE</h1>
        <div class="meta">
          {s.scenario && <span>{s.scenario.name}</span>}
          <span>{s.callsign}</span>
          <span class={`ws-dot ${s.wsConnected ? 'on' : ''}`} title={s.wsConnected ? 'LIVE' : 'OFFLINE'} />
          <button
            onClick={logout}
            style={{
              background: 'none', border: '1px solid #333', color: '#666',
              fontFamily: 'var(--font)', fontSize: '9px', padding: '2px 8px',
              cursor: 'pointer', borderRadius: '3px',
            }}
          >
            LOGOUT
          </button>
        </div>
      </header>

      <div class="panels">
        <div class="panel">
          <div class="panel-header">
            <span>LANE GRID</span>
            <span>{s.lanes.length} LANES</span>
          </div>
          <div class="panel-body">
            <GridPanel />
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span>EVENT FEED</span>
            <span>{s.events.length}</span>
          </div>
          <div class="panel-body" style={{ padding: '4px 8px' }}>
            <EventsPanel />
          </div>
        </div>

        <div class="panel control">
          <div class="panel-header">
            <span>CONTROL PANEL</span>
          </div>
          <div class="panel-body">
            <ControlPanel />
          </div>
        </div>
      </div>
    </>
  );
}

function LoginScreen() {
  const [callsign, setCallsign] = useState('');
  const [password, setPassword] = useState('');
  const [scenarioId, setScenarioId] = useState('1');
  const [s, setS] = useState(getState());

  useEffect(() => subscribe(() => setS(getState())), []);

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    if (!callsign || !password) return;
    await login(callsign, password, parseInt(scenarioId, 10) || 1);
  };

  return (
    <div class="login-overlay">
      <form class="login-box" onSubmit={handleLogin}>
        <h1>M MODE</h1>
        <div class="sub">DIRECTOR CONSOLE — CLASSIFIED ACCESS</div>

        <input
          type="text" value={callsign}
          onInput={(e) => setCallsign((e.target as HTMLInputElement).value)}
          placeholder="CALLSIGN"
        />
        <input
          type="password" value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          placeholder="PASSWORD"
        />
        <input
          type="text" value={scenarioId}
          onInput={(e) => setScenarioId((e.target as HTMLInputElement).value)}
          placeholder="SCENARIO ID"
        />

        {s.error && <div class="error">{s.error}</div>}

        <button type="submit" class="ctrl-btn" style={{ width: '240px', padding: '8px' }}
          disabled={s.loading}>
          {s.loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
        </button>
      </form>
    </div>
  );
}

const target = document.getElementById('app');
if (target) {
  target.innerHTML = '';

  // Test 1: Minimal Preact render
  console.log('[MMODE] Test: minimal render...');
  render(<div id="test-minimal">PREACT WORKS</div>, target);
  console.log('[MMODE] After minimal render, children =', target.children.length, 'html =', target.innerHTML.substring(0, 200));

  if (target.children.length === 0) {
    // Preact render is broken (likely SES lockdown) — use plain DOM
    console.warn('[MMODE] Preact render broken, falling back to DOM API');
    target.innerHTML = '';
    renderWithDOM(target);
  } else {
    // Preact works — render the real app
    console.log('[MMODE] Preact OK, rendering full app...');
    target.innerHTML = '';
    render(<App />, target);
  }
}

// ===== Plain DOM fallback for when SES/lockdown breaks Preact =====

const STORAGE_KEY = 'eyesonly_mmode_session';

interface Session { token: string; callsign: string; scenarioId: number; }

function getSession(): Session | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) { const d = JSON.parse(s); if (d.token) return d as Session; }
  } catch { /* ignore */ }
  return null;
}

async function mFetch(path: string, session: Session, opts: RequestInit = {}): Promise<Response> {
  return fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, ...(opts.headers || {}) },
  });
}

function renderWithDOM(container: HTMLElement) {
  const session = getSession();
  if (session) {
    renderConsole(container, session);
  } else {
    renderLogin(container);
  }
}

// --- Login Screen ---
function renderLogin(container: HTMLElement) {
  const overlay = document.createElement('div');
  overlay.className = 'login-overlay';
  const box = document.createElement('form');
  box.className = 'login-box';
  box.innerHTML = `
    <h1>M MODE</h1>
    <div class="sub">DIRECTOR CONSOLE — CLASSIFIED ACCESS</div>
    <input type="text" id="m-callsign" placeholder="CALLSIGN" autocomplete="off" />
    <input type="password" id="m-password" placeholder="PASSWORD" autocomplete="off" />
    <input type="text" id="m-scenario" placeholder="SCENARIO ID" value="1" />
    <div id="m-error" class="error" style="display:none"></div>
    <button type="submit" class="ctrl-btn" style="width:240px;padding:8px">AUTHENTICATE</button>
  `;
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const callsign = (document.getElementById('m-callsign') as HTMLInputElement).value;
    const password = (document.getElementById('m-password') as HTMLInputElement).value;
    const scenarioId = (document.getElementById('m-scenario') as HTMLInputElement).value || '1';
    const errEl = document.getElementById('m-error')!;
    const btn = box.querySelector('button')!;
    if (!callsign || !password) { errEl.textContent = 'Enter callsign and password'; errEl.style.display = ''; return; }
    btn.textContent = 'AUTHENTICATING...'; btn.disabled = true; errEl.style.display = 'none';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callsign, password, scenario_id: parseInt(scenarioId, 10) || 1 }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as any; throw new Error(d.message || 'Login failed'); }
      const data = await res.json() as any;
      if (data.actor?.team !== 'director') throw new Error('Director access required');
      const session: Session = { token: data.token, callsign: data.actor.callsign, scenarioId: data.actor.scenario_id };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      // Transition to console without reload
      container.innerHTML = '';
      renderConsole(container, session);
    } catch (err: any) {
      errEl.textContent = err.message || 'Network error'; errEl.style.display = '';
      btn.textContent = 'AUTHENTICATE'; btn.disabled = false;
    }
  });
  overlay.appendChild(box);
  container.appendChild(overlay);
}

// --- Director Console (DOM-based) ---
function renderConsole(container: HTMLElement, session: Session) {
  container.innerHTML = `
    <header class="m-header">
      <h1>M MODE</h1>
      <div class="meta">
        <span id="m-scenario-name">LOADING...</span>
        <span>${session.callsign}</span>
        <span id="m-ws-dot" class="ws-dot" title="OFFLINE"></span>
        <button id="m-logout" style="background:none;border:1px solid #333;color:#666;font-family:var(--font);font-size:9px;padding:2px 8px;cursor:pointer;border-radius:3px;">LOGOUT</button>
      </div>
    </header>
    <div class="panels">
      <div class="panel">
        <div class="panel-header"><span>LANE GRID</span><span id="m-lane-count">0 LANES</span></div>
        <div class="panel-body" id="m-grid-body" style="padding:12px;"></div>
      </div>
      <div class="panel">
        <div class="panel-header"><span>EVENT FEED</span><span id="m-event-count">0</span></div>
        <div class="panel-body" id="m-events-body" style="padding:4px 8px;"></div>
      </div>
      <div class="panel control">
        <div class="panel-header"><span>CONTROL PANEL</span></div>
        <div class="panel-body" id="m-ctrl-body"></div>
      </div>
    </div>
  `;

  // Logout
  document.getElementById('m-logout')!.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    container.innerHTML = '';
    renderLogin(container);
  });

  // Load grid data
  loadGrid(session);
  loadEvents(session);
  buildControlPanel(session);

  // Connect WebSocket
  connectWS(session);

  // Auto-refresh events every 10s
  setInterval(() => loadEvents(session), 10000);
}

async function loadGrid(session: Session) {
  try {
    const res = await mFetch(`/m/grid/${session.scenarioId}`, session);
    if (!res.ok) return;
    const data = await res.json() as any;
    document.getElementById('m-scenario-name')!.textContent = data.scenario?.name || 'UNKNOWN';
    const lanes = data.lanes || [];
    document.getElementById('m-lane-count')!.textContent = lanes.length + ' LANES';
    const gridBody = document.getElementById('m-grid-body')!;
    if (lanes.length === 0) {
      gridBody.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">No lanes configured. Use Control Panel to add lanes.</div>';
      return;
    }
    gridBody.innerHTML = lanes.map((lane: any) => {
      const actors = (lane.actors || []).map((a: any) =>
        `<div class="actor-item"><span class="actor-dot ${a.team}"></span><span>${a.callsign}</span><span style="color:#555;font-size:9px;margin-left:auto;">${a.status}</span></div>`
      ).join('');
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:8px;margin-bottom:6px;">
        <div style="font-size:10px;letter-spacing:2px;color:var(--text-dim);margin-bottom:4px;">${lane.label || lane.lane_id}</div>
        <div class="actor-list">${actors || '<div style="color:#333;font-size:10px;">EMPTY</div>'}</div>
      </div>`;
    }).join('');
  } catch { /* offline */ }
}

async function loadEvents(session: Session) {
  try {
    const res = await mFetch(`/m/events/${session.scenarioId}?limit=100`, session);
    if (!res.ok) return;
    const data = await res.json() as any;
    const events = data.events || [];
    document.getElementById('m-event-count')!.textContent = String(events.length);
    const evBody = document.getElementById('m-events-body')!;
    if (events.length === 0) {
      evBody.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">No events yet.</div>';
      return;
    }
    evBody.innerHTML = '<div class="feed">' + events.slice(-50).reverse().map((ev: any) => {
      const ts = new Date(ev.created_at).toLocaleTimeString();
      const cls = ev.event_type || '';
      const payload = ev.payload ? (typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload)) : '';
      return `<div class="feed-item ${cls}"><span class="ts">${ts}</span> <strong>${ev.event_type}</strong> ${payload.substring(0, 80)}</div>`;
    }).join('') + '</div>';
  } catch { /* offline */ }
}

function buildControlPanel(session: Session) {
  const ctrl = document.getElementById('m-ctrl-body')!;
  ctrl.innerHTML = `
    <div class="ctrl-grid">
      <div class="ctrl-section">
        <h3>ADD LANE</h3>
        <div class="ctrl-row">
          <div class="ctrl-field"><label>LANE ID</label><input type="text" id="ctrl-lane-id" placeholder="e.g. ALPHA" /></div>
          <div class="ctrl-field"><label>LABEL</label><input type="text" id="ctrl-lane-label" placeholder="e.g. Alpha Lane" /></div>
          <button class="ctrl-btn" id="ctrl-add-lane">ADD</button>
        </div>
      </div>
      <div class="ctrl-section">
        <h3>ADD ACTOR</h3>
        <div class="ctrl-row">
          <div class="ctrl-field"><label>CALLSIGN</label><input type="text" id="ctrl-actor-callsign" /></div>
          <div class="ctrl-field"><label>TEAM</label>
            <select id="ctrl-actor-team"><option value="red">RED</option><option value="blue">BLUE</option><option value="director">DIRECTOR</option></select>
          </div>
          <div class="ctrl-field"><label>PASSWORD</label><input type="text" id="ctrl-actor-pw" /></div>
          <button class="ctrl-btn" id="ctrl-add-actor">ADD</button>
        </div>
      </div>
      <div class="ctrl-section">
        <h3>INJECT EVENT</h3>
        <div class="ctrl-row">
          <div class="ctrl-field"><label>TYPE</label><input type="text" id="ctrl-event-type" placeholder="e.g. intel" /></div>
          <div class="ctrl-field"><label>MESSAGE</label><input type="text" id="ctrl-event-msg" placeholder="Event payload" /></div>
          <button class="ctrl-btn amber" id="ctrl-inject">INJECT</button>
        </div>
      </div>
      <div class="ctrl-section">
        <h3>ESCALATION</h3>
        <div class="ctrl-row">
          <div class="ctrl-field"><label>TIER</label>
            <select id="ctrl-esc-tier"><option value="1">TIER 1</option><option value="2">TIER 2</option><option value="3">TIER 3</option></select>
          </div>
          <div class="ctrl-field"><label>MESSAGE</label><input type="text" id="ctrl-esc-msg" placeholder="Optional" /></div>
          <button class="ctrl-btn danger" id="ctrl-escalate">ESCALATE</button>
        </div>
      </div>
      <div class="ctrl-section">
        <h3>JOIN CODES</h3>
        <div class="ctrl-row">
          <div class="ctrl-field"><label>TEAM</label>
            <select id="ctrl-jc-team"><option value="red">RED</option><option value="blue">BLUE</option></select>
          </div>
          <button class="ctrl-btn" id="ctrl-gen-code">GENERATE</button>
        </div>
        <div id="ctrl-jc-result" style="margin-top:6px;font-size:12px;color:var(--accent);"></div>
      </div>
    </div>
  `;

  // Wire up control buttons
  document.getElementById('ctrl-add-lane')!.addEventListener('click', async () => {
    const lid = (document.getElementById('ctrl-lane-id') as HTMLInputElement).value;
    const label = (document.getElementById('ctrl-lane-label') as HTMLInputElement).value;
    if (!lid) return;
    await mFetch('/m/lane', session, { method: 'POST', body: JSON.stringify({ scenario_id: session.scenarioId, lane_id: lid, label: label || lid, sort_order: 0 }) });
    loadGrid(session);
  });

  document.getElementById('ctrl-add-actor')!.addEventListener('click', async () => {
    const cs = (document.getElementById('ctrl-actor-callsign') as HTMLInputElement).value;
    const team = (document.getElementById('ctrl-actor-team') as HTMLSelectElement).value;
    const pw = (document.getElementById('ctrl-actor-pw') as HTMLInputElement).value;
    if (!cs) return;
    await mFetch('/m/actor', session, { method: 'POST', body: JSON.stringify({ scenario_id: session.scenarioId, callsign: cs, team, password: pw || undefined }) });
    loadGrid(session);
  });

  document.getElementById('ctrl-inject')!.addEventListener('click', async () => {
    const evType = (document.getElementById('ctrl-event-type') as HTMLInputElement).value;
    const msg = (document.getElementById('ctrl-event-msg') as HTMLInputElement).value;
    if (!evType) return;
    await mFetch('/m/event', session, { method: 'POST', body: JSON.stringify({ event_type: evType, payload: { message: msg } }) });
    loadEvents(session);
  });

  document.getElementById('ctrl-escalate')!.addEventListener('click', async () => {
    const tier = parseInt((document.getElementById('ctrl-esc-tier') as HTMLSelectElement).value, 10);
    const msg = (document.getElementById('ctrl-esc-msg') as HTMLInputElement).value;
    await mFetch('/m/escalation', session, { method: 'POST', body: JSON.stringify({ scenario_id: session.scenarioId, tier, message: msg || undefined }) });
    loadEvents(session);
  });

  document.getElementById('ctrl-gen-code')!.addEventListener('click', async () => {
    const team = (document.getElementById('ctrl-jc-team') as HTMLSelectElement).value;
    const res = await mFetch('/m/join-code', session, { method: 'POST', body: JSON.stringify({ scenario_id: session.scenarioId, team }) });
    if (res.ok) {
      const data = await res.json() as any;
      document.getElementById('ctrl-jc-result')!.textContent = 'CODE: ' + (data.join_code?.code || 'ERROR');
    }
  });
}

function connectWS(session: Session) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    const ws = new WebSocket(`${proto}//${location.host}/api/m/ws`);
    ws.onopen = () => {
      const dot = document.getElementById('m-ws-dot');
      if (dot) { dot.classList.add('on'); dot.title = 'LIVE'; }
    };
    ws.onmessage = () => {
      loadGrid(session);
      loadEvents(session);
    };
    ws.onclose = () => {
      const dot = document.getElementById('m-ws-dot');
      if (dot) { dot.classList.remove('on'); dot.title = 'OFFLINE'; }
      setTimeout(() => connectWS(session), 3000);
    };
    ws.onerror = () => ws.close();
  } catch { /* WS unavailable */ }
}
