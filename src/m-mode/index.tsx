/* ============================================================
   EYES ONLY — M Mode Director Console Entry Point
   UGRS Tactical Map System — DOM-based rendering.
   ============================================================ */

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
  useEffect(() => { init(); setS(getState()); return subscribe(() => setS(getState())); }, []);
  if (s.auth === 'login') return <LoginScreen />;
  return (
    <>
      <header class="m-header"><h1>M MODE</h1>
        <div class="meta">
          {s.scenario && <span>{s.scenario.name}</span>}
          <span>{s.callsign}</span>
          <span class={`ws-dot ${s.wsConnected ? 'on' : ''}`} title={s.wsConnected ? 'LIVE' : 'OFFLINE'} />
          <button onClick={logout} style={{ background:'none',border:'1px solid #333',color:'#666',fontFamily:'var(--font)',fontSize:'9px',padding:'2px 8px',cursor:'pointer',borderRadius:'3px' }}>LOGOUT</button>
        </div>
      </header>
      <div class="panels">
        <div class="panel"><div class="panel-header"><span>LANE GRID</span><span>{s.lanes.length} LANES</span></div><div class="panel-body"><GridPanel /></div></div>
        <div class="panel"><div class="panel-header"><span>EVENT FEED</span><span>{s.events.length}</span></div><div class="panel-body" style={{ padding: '4px 8px' }}><EventsPanel /></div></div>
        <div class="panel control"><div class="panel-header"><span>CONTROL PANEL</span></div><div class="panel-body"><ControlPanel /></div></div>
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
        <input type="text" value={callsign} onInput={(e) => setCallsign((e.target as HTMLInputElement).value)} placeholder="CALLSIGN" />
        <input type="password" value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} placeholder="PASSWORD" />
        <input type="text" value={scenarioId} onInput={(e) => setScenarioId((e.target as HTMLInputElement).value)} placeholder="SCENARIO ID" />
        {s.error && <div class="error">{s.error}</div>}
        <button type="submit" class="ctrl-btn" style={{ width: '240px', padding: '8px' }} disabled={s.loading}>{s.loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}</button>
      </form>
    </div>
  );
}

const target = document.getElementById('app');
if (target) {
  target.innerHTML = '';
  console.log('[MMODE] Test: minimal render...');
  render(<div id="test-minimal">PREACT WORKS</div>, target);
  console.log('[MMODE] After minimal render, children =', target.children.length, 'html =', target.innerHTML.substring(0, 200));

  if (target.children.length === 0) {
    console.warn('[MMODE] Preact render broken, falling back to DOM API');
    target.innerHTML = '';
    renderWithDOM(target);
  } else {
    console.log('[MMODE] Preact OK, rendering full app...');
    target.innerHTML = '';
    render(<App />, target);
  }
}

// ===== Plain DOM fallback for when SES/lockdown breaks Preact =====

const STORAGE_KEY = 'eyesonly_mmode_session';
const MAP_KEY = 'eyesonly_mmode_map';
const GRID_CONFIG_KEY = 'eyesonly_mmode_gridcfg';

// ===== MOK System =====
type MOKVisualState = 'idle' | 'monitoring' | 'advisory' | 'urgent' | 'engaged';
type MOKMessageType = 'advisory' | 'warning' | 'directive' | 'critical';
type SquelchMode = 'full' | 'quiet' | 'silent' | 'tactical';

let mokVisualState: MOKVisualState = 'idle';
let mokSquelch: SquelchMode = 'full';
let mokAudioCtx: AudioContext | null = null;
let scenarioStartTime: number = Date.now();
let opBarInterval: ReturnType<typeof setInterval> | null = null;

interface Session { token: string; callsign: string; scenarioId: number; }
interface GridCell { cell_id: string; col: number; row: number; lane_id: string | null; status: string; tension: number; notes: string; actors: any[]; dead_drops: any[]; }
interface GridData { config: any; cells: GridCell[]; frozen: boolean; unassigned_actors: any[]; }

// --- Panel State Machine ---
type PanelMode = 'overview' | 'cell' | 'actor' | 'assign_lane' | 'move_actor';
let panelMode: PanelMode = 'overview';
let selectedCellId: string | null = null;
let selectedActorId: number | null = null;
let selectedLaneId: string | null = null;
let moveActorId: number | null = null;
let cachedGridData: GridData | null = null;
let cachedSession: Session | null = null;
let isFrozen = false;

// --- MOK Visual State ---
function setMokState(state: MOKVisualState) {
  mokVisualState = state;
  const el = document.getElementById('mok-hud');
  if (el) {
    el.className = `mok-hud-mini ${state}`;
  }
}

function mokTickSound(urgent = false) {
  if (!mokAudioCtx) {
    try { mokAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return; }
  }
  const ctx = mokAudioCtx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = urgent ? 440 : 280;
  g.gain.value = urgent ? 0.02 : 0.008;
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (urgent ? 0.18 : 0.28));
  o.stop(ctx.currentTime + (urgent ? 0.2 : 0.3));
}

function mokTriggerVisual(type: MOKMessageType) {
  if (type === 'critical') {
    setMokState('urgent');
    mokTickSound(true);
    setTimeout(() => setMokState('monitoring'), 3000);
  } else if (type === 'advisory' || type === 'warning' || type === 'directive') {
    setMokState('advisory');
    if (type === 'warning') mokTickSound(false);
    setTimeout(() => setMokState('monitoring'), 2200);
  }
}

function mokSend(type: MOKMessageType, text: string) {
  // Always trigger visual (even in silent mode, triangle flashes)
  mokTriggerVisual(type);

  // Squelch filtering for feed
  if (mokSquelch === 'silent') return;
  if (mokSquelch === 'quiet' && type !== 'critical') return;
  if (mokSquelch === 'tactical' && type !== 'directive' && type !== 'critical') return;

  // Print to MOK feed
  const feedBody = document.getElementById('mok-feed-body');
  if (!feedBody) return;
  const ts = new Date().toLocaleTimeString();
  const msg = document.createElement('div');
  msg.className = `mok-msg mok-${type}`;
  msg.innerHTML = `<span class="mok-ts">${ts}</span><span class="mok-tag">[MOK]</span> ${text}`;
  feedBody.appendChild(msg);
  feedBody.scrollTop = feedBody.scrollHeight;

  // Update count
  const countEl = document.getElementById('mok-feed-count');
  if (countEl) countEl.textContent = String(feedBody.children.length);
}

function mokSetSquelch(mode: SquelchMode) {
  mokSquelch = mode;
  // Update button states
  document.querySelectorAll('.mok-squelch button').forEach((btn) => {
    const el = btn as HTMLElement;
    el.classList.toggle('active', el.dataset.squelch === mode);
  });
}

// --- Operation Bar ---
function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateOpBar() {
  // Elapsed time
  const elapsedEl = document.getElementById('op-elapsed');
  if (elapsedEl) elapsedEl.textContent = formatElapsed(Date.now() - scenarioStartTime);

  // Threat level (derived from grid tension)
  if (cachedGridData) {
    const cells = cachedGridData.cells || [];
    const totalCells = cells.length || 1;
    const avgTension = Math.round(cells.reduce((sum, c) => sum + c.tension, 0) / totalCells);

    const threatEl = document.getElementById('op-threat');
    if (threatEl) {
      let level = 'LOW';
      let cls = 'threat-low';
      if (avgTension >= 70) { level = 'CRITICAL'; cls = 'threat-critical'; }
      else if (avgTension >= 50) { level = 'HIGH'; cls = 'threat-high'; }
      else if (avgTension >= 25) { level = 'OPTIMAL'; cls = 'threat-optimal'; }
      threatEl.textContent = level;
      threatEl.className = `op-value ${cls}`;
    }

    // Actor counts
    const allActors = cells.flatMap((c) => c.actors || []);
    const unassigned = cachedGridData.unassigned_actors || [];
    const total = allActors.length + unassigned.length;
    const online = allActors.filter((a: any) => a.status !== 'dark' && a.status !== 'offline').length;
    const actorEl = document.getElementById('op-actors');
    if (actorEl) actorEl.textContent = `${online}/${total}`;

    // Tension numeric
    const tensionEl = document.getElementById('op-tension');
    if (tensionEl) tensionEl.textContent = `${avgTension}%`;
  }
}

// Expose MOK globally for dev/testing and future AI integration
(window as any)._MOK = {
  send: mokSend,
  setSquelch: mokSetSquelch,
  setState: setMokState,
  engage: (on: boolean) => setMokState(on ? 'engaged' : 'monitoring'),
};

function getSession(): Session | null {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) { const d = JSON.parse(s); if (d.token) return d as Session; } } catch {} return null;
}

async function mFetch(path: string, session: Session, opts: RequestInit = {}): Promise<Response> {
  return fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, ...(opts.headers || {}) },
  });
}

function renderWithDOM(container: HTMLElement) {
  const session = getSession();
  if (session) { renderConsole(container, session); } else { renderLogin(container); }
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
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callsign, password, scenario_id: parseInt(scenarioId, 10) || 1 }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as any; throw new Error(d.message || 'Login failed'); }
      const data = await res.json() as any;
      if (data.actor?.team !== 'director') throw new Error('Director access required');
      const session: Session = { token: data.token, callsign: data.actor.callsign, scenarioId: data.actor.scenario_id };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
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

// --- Director Console ---
function renderConsole(container: HTMLElement, session: Session) {
  cachedSession = session;
  panelMode = 'overview';
  selectedCellId = null;
  selectedActorId = null;

  scenarioStartTime = Date.now();

  container.innerHTML = `
    <header class="m-header" id="m-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <h1>M MODE</h1>
        <div id="mok-hud" class="mok-hud-mini idle" role="img" aria-label="MOK Director indicator. State: idle">
          <svg viewBox="0 0 220 48" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="mok-svg">
            <defs>
              <pattern id="mok-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M10 0H0V10" fill="none" stroke="#05260a" stroke-width="0.5"/>
              </pattern>
              <linearGradient id="mok-glow" x1="0" x2="1">
                <stop offset="0" stop-color="#16ff8f" stop-opacity="0.95"/>
                <stop offset="1" stop-color="#004e2a" stop-opacity="0.6"/>
              </linearGradient>
              <filter id="mok-blur" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.6" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <rect x="1" y="1" rx="6" ry="6" width="218" height="46" fill="rgba(0,0,0,0.5)" stroke="#083212" stroke-width="1.5"/>
            <rect x="6" y="6" width="208" height="36" fill="url(#mok-grid)" opacity="0.86"/>
            <rect x="-80" y="0" width="120" height="48" fill="url(#mok-glow)" opacity="0.06" class="mok-glow-band"/>
            <g transform="translate(110,24)" class="mok-glyph" aria-hidden="true">
              <path d="M-42 -2 L-22 -20 L22 -20 L42 -2 L-42 -2 Z" fill="url(#mok-glow)" opacity="0.8" filter="url(#mok-blur)"/>
              <path class="mok-triangle-core" d="M0 -16 L-10 6 L10 6 Z" fill="#00ff88" opacity="0.98"/>
              <path d="M-12 8 L12 8 L6 14 L-6 14 Z" fill="#00b36a" opacity="0.95"/>
            </g>
            <rect x="4" y="4" rx="5" ry="5" width="212" height="40" fill="none" stroke="rgba(0,255,160,0.06)" stroke-width="1"/>
            <g opacity="0.06">
              <rect x="6" y="6" width="208" height="1" fill="#000"/>
              <rect x="6" y="10" width="208" height="1" fill="#000"/>
              <rect x="6" y="14" width="208" height="1" fill="#000"/>
              <rect x="6" y="18" width="208" height="1" fill="#000"/>
              <rect x="6" y="22" width="208" height="1" fill="#000"/>
              <rect x="6" y="26" width="208" height="1" fill="#000"/>
              <rect x="6" y="30" width="208" height="1" fill="#000"/>
              <rect x="6" y="34" width="208" height="1" fill="#000"/>
            </g>
          </svg>
        </div>
        <div class="mok-squelch">
          <button data-squelch="full" class="active" title="All telemetry">F</button>
          <button data-squelch="quiet" title="Critical only">Q</button>
          <button data-squelch="tactical" title="Actionable only">T</button>
          <button data-squelch="silent" title="Silent">S</button>
        </div>
      </div>
      <div class="meta">
        <span id="m-scenario-name">LOADING...</span>
        <span>${session.callsign}</span>
        <span id="m-ws-dot" class="ws-dot" title="OFFLINE"></span>
        <button id="m-freeze-btn" class="freeze-btn">FREEZE GAME</button>
        <a href="/m/scenario-designer.html" style="background:none;border:1px solid #1a4a2a;color:#1a8a1a;font-family:var(--font);font-size:9px;padding:2px 8px;cursor:pointer;border-radius:3px;text-decoration:none;letter-spacing:1px;" title="Scenario Designer — build scenarios from narrative text">SCENARIO DESIGNER</a>
        <button id="m-logout" style="background:none;border:1px solid #333;color:#666;font-family:var(--font);font-size:9px;padding:2px 8px;cursor:pointer;border-radius:3px;">LOGOUT</button>
      </div>
    </header>
    <div class="op-bar" id="op-bar">
      <div class="op-metric"><span class="op-label">ELAPSED</span><span class="op-value" id="op-elapsed">00:00:00</span></div>
      <div class="op-metric"><span class="op-label">THREAT</span><span class="op-value threat-low" id="op-threat">LOW</span></div>
      <div class="op-metric"><span class="op-label">ACTORS</span><span class="op-value" id="op-actors">0/0</span></div>
      <div class="op-metric"><span class="op-label">TENSION</span><span class="op-value" id="op-tension">0%</span></div>
      <div class="op-metric"><span class="op-label">CELLS</span><span class="op-value" id="op-cells">0</span></div>
    </div>
    <div class="panels">
      <div class="panel" style="position:relative;">
        <div class="panel-header"><span>COMMAND MAP</span><span id="m-cell-count">0 CELLS</span></div>
        <div class="panel-body" id="m-grid-body" style="position:relative;"></div>
      </div>
      <div class="panel" style="display:flex;flex-direction:column;">
        <div class="panel-header"><span>EVENT FEED</span><span id="m-event-count">0</span></div>
        <div class="panel-body" id="m-events-body" style="padding:4px 8px;flex:1;"></div>
        <div class="mok-feed-panel" id="mok-feed-panel">
          <div class="mok-feed-header"><span>MOK FEED</span><span id="mok-feed-count">0</span></div>
          <div class="mok-feed-body" id="mok-feed-body"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><span id="m-ctrl-title">CONTROLS</span></div>
        <div class="panel-body" id="m-ctrl-body" style="padding:0;"></div>
      </div>
    </div>
  `;

  document.getElementById('m-logout')!.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    if (opBarInterval) { clearInterval(opBarInterval); opBarInterval = null; }
    container.innerHTML = '';
    renderLogin(container);
  });

  document.getElementById('m-freeze-btn')!.addEventListener('click', () => toggleFreeze(session));

  // Squelch buttons
  document.querySelectorAll('.mok-squelch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).dataset.squelch as SquelchMode;
      if (mode) mokSetSquelch(mode);
    });
  });

  // Start operation bar timer
  if (opBarInterval) clearInterval(opBarInterval);
  opBarInterval = setInterval(updateOpBar, 1000);

  // Set MOK to monitoring state after boot
  setTimeout(() => setMokState('monitoring'), 1500);

  // ESC key: go back in panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (panelMode === 'move_actor') { panelMode = 'actor'; renderRightPanel(session); }
      else if (panelMode === 'actor') { panelMode = 'cell'; renderRightPanel(session); }
      else if (panelMode === 'cell' || panelMode === 'assign_lane') { panelMode = 'overview'; selectedCellId = null; renderRightPanel(session); refreshGridSelection(); }
    }
  });

  initMapGrid(session);
  loadGridCells(session);
  loadEvents(session);
  renderRightPanel(session);
  connectWS(session);
  setInterval(() => loadEvents(session), 10000);
  setInterval(() => loadActorPositions(session), 15000);
}

// --- Map Grid with image overlay ---
function initMapGrid(session: Session) {
  const gridBody = document.getElementById('m-grid-body')!;
  const savedMap = localStorage.getItem(MAP_KEY) || '';

  gridBody.innerHTML = `
    <div class="map-container" id="m-map-container">
      ${savedMap ? '<img class="map-image" id="m-map-img" src="' + savedMap + '" />' : ''}
      <div id="m-ugrs-grid" class="ugrs-grid"></div>
    </div>
  `;

  // Drop zone for map images
  gridBody.addEventListener('dragover', (e) => { e.preventDefault(); gridBody.classList.add('dragover'); });
  gridBody.addEventListener('dragleave', () => gridBody.classList.remove('dragover'));
  gridBody.addEventListener('drop', (e) => {
    e.preventDefault();
    gridBody.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        localStorage.setItem(MAP_KEY, dataUrl);
        setMapImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  });
}

function setMapImage(dataUrl: string) {
  let img = document.getElementById('m-map-img') as HTMLImageElement;
  if (!img) {
    img = document.createElement('img');
    img.className = 'map-image';
    img.id = 'm-map-img';
    const mc = document.getElementById('m-map-container');
    if (mc) mc.insertBefore(img, mc.firstChild);
  }
  img.src = dataUrl;
}

// --- UGRS Grid Rendering ---
function renderUGRSGrid(data: GridData) {
  const gridEl = document.getElementById('m-ugrs-grid');
  if (!gridEl) return;

  const config = data.config;
  if (!config || !data.cells.length) {
    gridEl.innerHTML = `<div style="color:var(--text-dim);text-align:center;padding:40px;grid-column:1/-1;">
      No grid calibrated.<br><br><span style="font-size:9px;">Use CALIBRATE GRID in Controls to set up the UGRS grid.</span>
      <br><span style="font-size:9px;">Drag &amp; drop a map image here first.</span>
    </div>`;
    return;
  }

  const cols = config.cols;
  const rows = config.rows;
  const colLabels = config.col_labels || [];
  const rowLabels = config.row_labels || [];

  // Set grid template: row-label col + N data cols
  gridEl.style.gridTemplateColumns = `24px repeat(${cols}, 1fr)`;
  gridEl.style.gridTemplateRows = `20px repeat(${rows}, 1fr)`;

  let html = '<div class="ugrs-corner"></div>';

  // Column headers
  for (let c = 0; c < cols; c++) {
    html += `<div class="ugrs-col-header">${colLabels[c] || String.fromCharCode(65 + c)}</div>`;
  }

  // Rows
  for (let r = 0; r < rows; r++) {
    // Row header
    html += `<div class="ugrs-row-header">${rowLabels[r] || (r + 1)}</div>`;

    for (let c = 0; c < cols; c++) {
      const cellId = `${colLabels[c] || String.fromCharCode(65 + c)}${rowLabels[r] || (r + 1)}`;
      const cell = data.cells.find((cl) => cl.cell_id === cellId);
      if (!cell) {
        html += `<div class="ugrs-cell st-unknown" data-cell="${cellId}"><span class="ugrs-label">${cellId}</span></div>`;
        continue;
      }

      const st = cell.status || 'unknown';
      const hasActors = cell.actors && cell.actors.length > 0;
      const hasPulse = st === 'degraded' || st === 'compromised' || cell.tension > 70;
      const isSelected = cell.cell_id === selectedCellId;
      const isAssigning = panelMode === 'assign_lane';
      const isInLane = isAssigning && cell.lane_id === selectedLaneId;

      let classes = `ugrs-cell st-${st}`;
      if (hasActors) classes += ' has-actors';
      if (hasPulse) classes += ' pulse';
      if (isSelected) classes += ' selected';
      if (isInLane) classes += ' assign-highlight';

      // Actor badges
      let actorsHtml = '';
      if (cell.actors) {
        actorsHtml = cell.actors.map((a: any) =>
          `<span class="actor-badge team-${a.team}" title="${a.callsign} (${a.status})" data-actor-id="${a.id}">${a.callsign}</span>`
        ).join('');
      }

      // Dead drop markers
      let dropsHtml = '';
      if (cell.dead_drops && cell.dead_drops.length) {
        dropsHtml = cell.dead_drops.map((d: any) => `<span class="drop-marker" title="${d.label}">&#9670;</span>`).join('');
      }

      // Tension bar
      let tensionHtml = '';
      if (cell.tension > 0) {
        const tClass = cell.tension < 40 ? 't-low' : cell.tension < 70 ? 't-med' : 't-high';
        tensionHtml = `<div class="tension-bar ${tClass}" style="width:${cell.tension}%"></div>`;
      }

      // Lane tag
      const laneTag = cell.lane_id ? `<span class="lane-tag">${cell.lane_id}</span>` : '';

      html += `<div class="${classes}" data-cell="${cell.cell_id}">
        <span class="ugrs-label">${cell.cell_id}</span>
        ${laneTag}
        <div class="ugrs-cell-content">${actorsHtml}${dropsHtml}</div>
        ${tensionHtml}
      </div>`;
    }
  }

  gridEl.innerHTML = html;
  document.getElementById('m-cell-count')!.textContent = `${data.cells.length} CELLS`;

  // Frozen overlay
  if (data.frozen) {
    isFrozen = true;
    const existing = document.getElementById('m-frozen-overlay');
    if (!existing) {
      const overlay = document.createElement('div');
      overlay.id = 'm-frozen-overlay';
      overlay.className = 'frozen-overlay';
      overlay.innerHTML = '<div class="frozen-text">GAME FROZEN</div>';
      const gridBody = document.getElementById('m-grid-body');
      if (gridBody) gridBody.appendChild(overlay);
    }
    document.getElementById('m-header')?.classList.add('frozen');
    const freezeBtn = document.getElementById('m-freeze-btn');
    if (freezeBtn) { freezeBtn.textContent = 'UNFREEZE'; freezeBtn.classList.add('active'); }
  } else {
    isFrozen = false;
    document.getElementById('m-frozen-overlay')?.remove();
    document.getElementById('m-header')?.classList.remove('frozen');
    const freezeBtn = document.getElementById('m-freeze-btn');
    if (freezeBtn) { freezeBtn.textContent = 'FREEZE GAME'; freezeBtn.classList.remove('active'); }
  }

  // Cell click handlers
  gridEl.querySelectorAll('.ugrs-cell[data-cell]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (isFrozen) return;
      const cellId = (el as HTMLElement).dataset.cell!;

      // Move actor mode: clicking a cell dispatches the actor there
      if (panelMode === 'move_actor' && moveActorId && cachedSession) {
        doMoveActor(moveActorId, cellId, cachedSession);
        return;
      }

      // Assign lane mode: toggle cell in/out of lane
      if (panelMode === 'assign_lane' && selectedLaneId && cachedSession) {
        const cell = cachedGridData?.cells.find((c) => c.cell_id === cellId);
        const newLane = cell?.lane_id === selectedLaneId ? null : selectedLaneId;
        mFetch('/m/cell', cachedSession, {
          method: 'PATCH',
          body: JSON.stringify({ scenario_id: cachedSession.scenarioId, cell_id: cellId, lane_id: newLane }),
        }).then(() => loadGridCells(cachedSession!));
        return;
      }

      // Normal: select cell
      selectedCellId = cellId;
      panelMode = 'cell';
      refreshGridSelection();
      renderRightPanel(cachedSession!);
    });

    // Actor badge click within cell
    el.querySelectorAll('.actor-badge[data-actor-id]').forEach((badge) => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isFrozen) return;
        selectedActorId = parseInt((badge as HTMLElement).dataset.actorId!, 10);
        selectedCellId = (el as HTMLElement).dataset.cell!;
        panelMode = 'actor';
        renderRightPanel(cachedSession!);
      });
    });
  });
}

function refreshGridSelection() {
  document.querySelectorAll('.ugrs-cell.selected').forEach((el) => el.classList.remove('selected'));
  if (selectedCellId) {
    document.querySelector(`.ugrs-cell[data-cell="${selectedCellId}"]`)?.classList.add('selected');
  }
}

// --- Load Grid Cells from API ---
async function loadGridCells(session: Session) {
  try {
    const res = await mFetch(`/m/grid/${session.scenarioId}/cells`, session);
    if (!res.ok) {
      // Fallback: try old endpoint if UGRS grid not yet calibrated
      await loadLegacyGrid(session);
      return;
    }
    const data = await res.json() as GridData;
    cachedGridData = data;

    const scenarioRes = await mFetch(`/m/grid/${session.scenarioId}`, session);
    if (scenarioRes.ok) {
      const scenarioData = await scenarioRes.json() as any;
      document.getElementById('m-scenario-name')!.textContent = scenarioData.scenario?.name || 'UNKNOWN';
    }

    if (!data.config || !data.cells.length) {
      // No grid yet — show empty state
      const gridEl = document.getElementById('m-ugrs-grid');
      if (gridEl) {
        gridEl.innerHTML = `<div style="color:var(--text-dim);text-align:center;padding:40px;">
          No grid calibrated.<br><br><span style="font-size:9px;">Use CALIBRATE GRID in Controls to set up UGRS.</span>
          <br><span style="font-size:9px;">Drag &amp; drop a map image here.</span>
        </div>`;
      }
      return;
    }

    renderUGRSGrid(data);
    updateOpBar();

    // Update op-cells count
    const cellCountEl = document.getElementById('op-cells');
    if (cellCountEl) cellCountEl.textContent = String(data.cells.length);
  } catch (err) {
    console.error('[MMODE] loadGridCells error:', err);
    await loadLegacyGrid(session);
  }
}

// Fallback for scenarios without UGRS grid
async function loadLegacyGrid(session: Session) {
  try {
    const res = await mFetch(`/m/grid/${session.scenarioId}`, session);
    if (!res.ok) return;
    const data = await res.json() as any;
    document.getElementById('m-scenario-name')!.textContent = data.scenario?.name || 'UNKNOWN';
    document.getElementById('m-cell-count')!.textContent = `${data.lanes?.length || 0} LANES`;
    const gridEl = document.getElementById('m-ugrs-grid');
    if (gridEl && (!data.lanes || data.lanes.length === 0)) {
      gridEl.innerHTML = `<div style="color:var(--text-dim);text-align:center;padding:40px;">
        No lanes or grid cells.<br><br><span style="font-size:9px;">Use CALIBRATE GRID in Controls.</span>
      </div>`;
    }
  } catch {}
}

// --- Events ---
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
      return `<div class="feed-item ${cls}"><span class="ts">${ts}</span> <strong>${ev.event_type}</strong> ${payload.substring(0, 60)}</div>`;
    }).join('') + '</div>';
  } catch {}
}

// ===== LIVE ACTOR TELEMETRY =====

const MOTION_STATE_ICON: Record<string, string> = {
  unknown: '·', stationary: '◼', walking: '▶', running: '⚡', vehicle: '🚗', dropped: '⬇',
};

async function loadActorPositions(session: Session) {
  const listEl = document.getElementById('actor-telemetry-list');
  if (!listEl) return;
  try {
    const res = await mFetch(`/m/actors/positions/${session.scenarioId}`, session);
    if (!res.ok) { listEl.innerHTML = '<div style="font-size:9px;color:var(--red);">TELEMETRY UNAVAIL</div>'; return; }
    const data = await res.json() as any;
    const positions: any[] = data.positions || [];
    if (!positions.length) {
      listEl.innerHTML = '<div style="font-size:9px;color:var(--text-dim);padding:4px 0;">No actors.</div>';
      return;
    }
    const now = Date.now();
    listEl.innerHTML = positions.map((p: any) => {
      const ageMs = p.last_seen_at ? now - p.last_seen_at : null;
      const ageStr = ageMs == null ? 'NO DATA' : ageMs < 60000 ? `${Math.round(ageMs / 1000)}s ago` : `${Math.round(ageMs / 60000)}m ago`;
      const isStale = ageMs == null || ageMs > 120000;
      const motionIcon = MOTION_STATE_ICON[p.motion_state] || '·';
      const locStr = p.lat != null ? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` : 'NO GPS';
      const ageColor = isStale ? 'var(--red)' : ageMs! < 45000 ? 'var(--accent)' : 'var(--amber)';
      return `<div style="display:flex;flex-direction:column;padding:3px 0;border-bottom:1px solid rgba(40,40,40,0.4);gap:1px;">
        <div style="display:flex;justify-content:space-between;font-size:9px;">
          <span><span class="actor-badge team-${p.team}">${p.callsign}</span>&nbsp;${motionIcon}</span>
          <span style="color:${ageColor};font-size:8px;">${ageStr}</span>
        </div>
        <div style="font-size:8px;color:${isStale ? '#555' : 'var(--text-dim)'};letter-spacing:0.5px;">${locStr}</div>
      </div>`;
    }).join('');
  } catch {
    if (listEl) listEl.innerHTML = '<div style="font-size:9px;color:var(--red);">TELEMETRY ERROR</div>';
  }
}

// ===== CONTEXT-SENSITIVE RIGHT PANEL =====

function renderRightPanel(session: Session) {
  const ctrl = document.getElementById('m-ctrl-body');
  const titleEl = document.getElementById('m-ctrl-title');
  if (!ctrl) return;

  switch (panelMode) {
    case 'overview': renderOverviewPanel(ctrl, session, titleEl); break;
    case 'cell': renderCellPanel(ctrl, session, titleEl); break;
    case 'actor': renderActorPanel(ctrl, session, titleEl); break;
    case 'assign_lane': renderAssignLanePanel(ctrl, session, titleEl); break;
    case 'move_actor': renderMoveActorPanel(ctrl, session, titleEl); break;
  }
}

// --- Overview Panel ---
function renderOverviewPanel(ctrl: HTMLElement, session: Session, titleEl: HTMLElement | null) {
  if (titleEl) titleEl.textContent = 'CONTROLS';
  const cellCount = cachedGridData?.cells?.length || 0;
  const actorCount = cachedGridData?.cells?.reduce((sum, c) => sum + (c.actors?.length || 0), 0) || 0;
  const unassigned = cachedGridData?.unassigned_actors?.length || 0;
  const avgTension = cellCount ? Math.round((cachedGridData?.cells?.reduce((sum, c) => sum + c.tension, 0) || 0) / cellCount) : 0;

  // Build actor roster
  const deployedActors = cachedGridData?.cells?.flatMap((c) => (c.actors || []).map((a: any) => ({ ...a, cell_id: c.cell_id }))) || [];
  const unassignedActors = cachedGridData?.unassigned_actors || [];
  const allActors = [...deployedActors, ...unassignedActors];

  const actorStatusDot = (status: string) => {
    const colors: Record<string, string> = { active: 'var(--accent)', holding: 'var(--amber)', engaging: 'var(--blue)', dark: '#555', standby: '#666' };
    return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${colors[status] || '#444'};margin-right:3px;"></span>`;
  };

  const actorRows = allActors.length ? allActors.map((a: any) =>
    `<div class="ctx-actor-roster-row" data-actor-id="${a.id}" style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;cursor:pointer;border-bottom:1px solid rgba(40,40,40,0.3);">
      <span>${actorStatusDot(a.status || 'standby')}<span class="actor-badge team-${a.team}">${a.callsign}</span></span>
      <span style="font-size:8px;color:#555;">${a.cell_id || 'UNASSIGNED'} · ${(a.status || 'standby').toUpperCase()}</span>
    </div>`
  ).join('') : '<div style="font-size:9px;color:var(--text-dim);padding:4px 0;">No actors in scenario.</div>';

  ctrl.innerHTML = `
    <div class="ctrl-stack">
      <div class="ctrl-section">
        <h3>SCENARIO</h3>
        <div class="ctx-stat"><span>CELLS</span><span class="value">${cellCount}</span></div>
        <div class="ctx-stat"><span>ACTORS</span><span class="value">${actorCount} deployed / ${unassigned} unassigned</span></div>
        <div class="ctx-stat"><span>AVG TENSION</span><span class="value">${avgTension}%</span></div>
      </div>
      <div class="ctrl-section">
        <h3>ACTOR NETWORK</h3>
        <div id="actor-roster" style="max-height:140px;overflow-y:auto;padding:2px 0;">${actorRows}</div>
      </div>
      <div class="ctrl-section">
        <h3>LIVE TELEMETRY</h3>
        <div id="actor-telemetry-list" style="max-height:150px;overflow-y:auto;padding:2px 0;">
          <div style="font-size:9px;color:var(--text-dim);padding:4px 0;">Loading positions…</div>
        </div>
        <button class="ctrl-btn" id="ctrl-refresh-telemetry" style="margin-top:4px;font-size:8px;">REFRESH POSITIONS</button>
      </div>
      <div class="ctrl-section">
        <h3>MAP</h3>
        <input type="file" id="ctrl-map-file" accept="image/*" style="display:none" />
        <button class="ctrl-btn" id="ctrl-map-upload">UPLOAD MAP IMAGE</button>
      </div>
      <div class="ctrl-section">
        <h3>CALIBRATE GRID</h3>
        <div class="ctrl-row">
          <div class="ctrl-field"><label>COLS</label><input type="number" id="ctrl-cal-cols" value="6" min="1" max="26" /></div>
          <div class="ctrl-field"><label>ROWS</label><input type="number" id="ctrl-cal-rows" value="4" min="1" max="20" /></div>
        </div>
        <button class="ctrl-btn amber" id="ctrl-calibrate" style="margin-top:4px;">CALIBRATE</button>
      </div>
      <div class="ctrl-section">
        <h3>ADD LANE</h3>
        <div class="ctrl-field"><label>ID</label><input type="text" id="ctrl-lane-id" placeholder="ALPHA" /></div>
        <div class="ctrl-field"><label>LABEL</label><input type="text" id="ctrl-lane-label" placeholder="Alpha Lane" /></div>
        <button class="ctrl-btn" id="ctrl-add-lane">ADD LANE</button>
      </div>
      <div class="ctrl-section">
        <h3>ASSIGN CELLS TO LANE</h3>
        <div class="ctrl-field"><label>LANE</label>
          <select id="ctrl-assign-lane-select"><option value="">— select lane —</option></select>
        </div>
        <button class="ctrl-btn amber" id="ctrl-start-assign">START ASSIGNING</button>
      </div>
      <div class="ctrl-section">
        <h3>ADD ACTOR</h3>
        <div class="ctrl-field"><label>CALLSIGN</label><input type="text" id="ctrl-actor-callsign" /></div>
        <div class="ctrl-row">
          <div class="ctrl-field"><label>TEAM</label>
            <select id="ctrl-actor-team"><option value="red">RED</option><option value="blue">BLUE</option><option value="director">DIR</option></select>
          </div>
        </div>
        <div class="ctrl-field"><label>PASSWORD</label><input type="text" id="ctrl-actor-pw" /></div>
        <button class="ctrl-btn" id="ctrl-add-actor">ADD ACTOR</button>
      </div>
      <div class="ctrl-section">
        <h3>INJECT EVENT</h3>
        <div class="ctrl-field"><label>TYPE</label><input type="text" id="ctrl-event-type" placeholder="intel" /></div>
        <div class="ctrl-field"><label>MSG</label><input type="text" id="ctrl-event-msg" placeholder="payload" /></div>
        <button class="ctrl-btn amber" id="ctrl-inject">INJECT</button>
      </div>
      <div class="ctrl-section">
        <h3>JOIN CODES</h3>
        <div class="ctrl-field"><label>TEAM</label>
          <select id="ctrl-jc-team"><option value="red">RED</option><option value="blue">BLUE</option></select>
        </div>
        <button class="ctrl-btn" id="ctrl-gen-code">GENERATE</button>
        <div id="ctrl-jc-result" style="margin-top:4px;font-size:11px;color:var(--accent);word-break:break-all;"></div>
      </div>
      <div class="ctrl-section">
        <h3>ESCALATION PRESETS</h3>
        <div class="escalation-presets">
          <button class="ctrl-btn amber" data-esc-preset="surveillance_sweep" title="Inject surveillance sweep event into active lanes">SURVEILLANCE SWEEP</button>
          <button class="ctrl-btn amber" data-esc-preset="inject_contact" title="Signal approaching contact to all actors">INJECT CONTACT</button>
          <button class="ctrl-btn danger" data-esc-preset="escalate_zone" title="Raise tension +25 on all non-offline cells">ESCALATE ZONE</button>
          <button class="ctrl-btn" data-esc-preset="stand_down" title="Reset all cells to working, tension to 0">STAND DOWN</button>
        </div>
        <div id="esc-preset-result" style="margin-top:4px;font-size:9px;color:var(--text-dim);"></div>
      </div>
      <div class="ctrl-section">
        <h3>BROADCAST</h3>
        <div class="ctrl-field"><label>MESSAGE</label><input type="text" id="ctrl-broadcast-msg" placeholder="Broadcast to all Ops..." /></div>
        <button class="ctrl-btn amber" id="ctrl-broadcast-send">BROADCAST TO OPS</button>
      </div>
    </div>
  `;

  // Actor roster click → actor panel
  ctrl.querySelectorAll('.ctx-actor-roster-row[data-actor-id]').forEach((row) => {
    row.addEventListener('click', () => {
      selectedActorId = parseInt((row as HTMLElement).dataset.actorId!, 10);
      const actor = allActors.find((a: any) => a.id === selectedActorId);
      if (actor?.cell_id) selectedCellId = actor.cell_id;
      panelMode = 'actor';
      renderRightPanel(session);
    });
  });

  // Populate lane dropdown for assignment
  populateLaneSelect('ctrl-assign-lane-select', session);

  // Live telemetry refresh
  loadActorPositions(session);
  document.getElementById('ctrl-refresh-telemetry')?.addEventListener('click', () => loadActorPositions(session));

  // Map upload
  document.getElementById('ctrl-map-upload')!.addEventListener('click', () => document.getElementById('ctrl-map-file')!.click());
  document.getElementById('ctrl-map-file')!.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => { const url = reader.result as string; localStorage.setItem(MAP_KEY, url); setMapImage(url); };
      reader.readAsDataURL(file);
    }
  });

  // Calibrate
  document.getElementById('ctrl-calibrate')!.addEventListener('click', async () => {
    const cols = parseInt((document.getElementById('ctrl-cal-cols') as HTMLInputElement).value, 10) || 6;
    const rows = parseInt((document.getElementById('ctrl-cal-rows') as HTMLInputElement).value, 10) || 4;
    const btn = document.getElementById('ctrl-calibrate') as HTMLButtonElement;
    btn.textContent = 'CALIBRATING...'; btn.disabled = true;
    try {
      const res = await mFetch('/m/grid/calibrate', session, {
        method: 'POST',
        body: JSON.stringify({ scenario_id: session.scenarioId, cols, rows }),
      });
      if (res.ok) {
        await loadGridCells(session);
        renderRightPanel(session);
      }
    } catch {}
    btn.textContent = 'CALIBRATE'; btn.disabled = false;
  });

  // Add lane
  document.getElementById('ctrl-add-lane')!.addEventListener('click', async () => {
    const lid = (document.getElementById('ctrl-lane-id') as HTMLInputElement).value;
    const label = (document.getElementById('ctrl-lane-label') as HTMLInputElement).value;
    if (!lid) return;
    await mFetch('/m/lane', session, { method: 'POST', body: JSON.stringify({ scenario_id: session.scenarioId, lane_id: lid, label: label || lid, sort_order: 0 }) });
    (document.getElementById('ctrl-lane-id') as HTMLInputElement).value = '';
    (document.getElementById('ctrl-lane-label') as HTMLInputElement).value = '';
    renderRightPanel(session);
  });

  // Start assign lane
  document.getElementById('ctrl-start-assign')!.addEventListener('click', () => {
    const laneId = (document.getElementById('ctrl-assign-lane-select') as unknown as HTMLSelectElement).value;
    if (!laneId) return;
    selectedLaneId = laneId;
    panelMode = 'assign_lane';
    renderRightPanel(session);
    loadGridCells(session);
  });

  // Add actor
  document.getElementById('ctrl-add-actor')!.addEventListener('click', async () => {
    const cs = (document.getElementById('ctrl-actor-callsign') as HTMLInputElement).value;
    const team = (document.getElementById('ctrl-actor-team') as unknown as HTMLSelectElement).value;
    const pw = (document.getElementById('ctrl-actor-pw') as HTMLInputElement).value;
    if (!cs) return;
    await mFetch('/m/actor', session, { method: 'POST', body: JSON.stringify({ scenario_id: session.scenarioId, callsign: cs, team, password: pw || undefined }) });
    (document.getElementById('ctrl-actor-callsign') as HTMLInputElement).value = '';
    (document.getElementById('ctrl-actor-pw') as HTMLInputElement).value = '';
    loadGridCells(session);
  });

  // Inject event
  document.getElementById('ctrl-inject')!.addEventListener('click', async () => {
    const evType = (document.getElementById('ctrl-event-type') as HTMLInputElement).value;
    const msg = (document.getElementById('ctrl-event-msg') as HTMLInputElement).value;
    if (!evType) return;
    await mFetch('/m/event', session, { method: 'POST', body: JSON.stringify({ event_type: evType, payload: { message: msg } }) });
    (document.getElementById('ctrl-event-type') as HTMLInputElement).value = '';
    (document.getElementById('ctrl-event-msg') as HTMLInputElement).value = '';
    loadEvents(session);
  });

  // Join codes
  document.getElementById('ctrl-gen-code')!.addEventListener('click', async () => {
    const team = (document.getElementById('ctrl-jc-team') as unknown as HTMLSelectElement).value;
    const res = await mFetch('/m/join-code', session, { method: 'POST', body: JSON.stringify({ scenario_id: session.scenarioId, team }) });
    if (res.ok) { const data = await res.json() as any; document.getElementById('ctrl-jc-result')!.textContent = 'CODE: ' + (data.join_code?.code || 'ERROR'); }
  });

  // --- Escalation Presets ---
  ctrl.querySelectorAll('[data-esc-preset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const preset = (btn as HTMLElement).dataset.escPreset!;
      const b = btn as HTMLButtonElement;
      const origText = b.textContent;
      b.textContent = 'EXECUTING...'; b.disabled = true;
      const resultEl = document.getElementById('esc-preset-result');

      try {
        if (preset === 'surveillance_sweep') {
          await mFetch('/m/event', session, {
            method: 'POST',
            body: JSON.stringify({ event_type: 'surveillance_sweep', payload: { message: 'Surveillance sweep — all lanes. Operatives maintain cover.' } }),
          });
          mokSend('directive', 'Surveillance sweep deployed across all lanes.');
          if (resultEl) resultEl.textContent = 'Surveillance sweep injected.';

        } else if (preset === 'inject_contact') {
          await mFetch('/m/event', session, {
            method: 'POST',
            body: JSON.stringify({ event_type: 'contact_injection', payload: { message: 'Approaching contact detected. All actors maintain position.' } }),
          });
          mokSend('warning', 'Contact injection deployed. Actors alerted.');
          if (resultEl) resultEl.textContent = 'Contact injection sent.';

        } else if (preset === 'escalate_zone') {
          // Raise tension +25 on all non-offline cells
          const cells = cachedGridData?.cells?.filter((c) => c.status !== 'offline') || [];
          let updated = 0;
          for (const cell of cells) {
            const newTension = Math.min(100, cell.tension + 25);
            if (newTension !== cell.tension) {
              await mFetch('/m/cell', session, {
                method: 'PATCH',
                body: JSON.stringify({ scenario_id: session.scenarioId, cell_id: cell.cell_id, tension: newTension }),
              });
              updated++;
            }
          }
          mokSend('critical', `Zone escalation: +25 tension on ${updated} cells.`);
          if (resultEl) resultEl.textContent = `Escalated ${updated} cells.`;
          await loadGridCells(session);

        } else if (preset === 'stand_down') {
          const cells = cachedGridData?.cells || [];
          for (const cell of cells) {
            if (cell.tension > 0 || cell.status !== 'working') {
              await mFetch('/m/cell', session, {
                method: 'PATCH',
                body: JSON.stringify({ scenario_id: session.scenarioId, cell_id: cell.cell_id, status: 'working', tension: 0 }),
              });
            }
          }
          mokSend('advisory', 'Stand down. All cells reset to working / 0% tension.');
          if (resultEl) resultEl.textContent = 'All cells reset.';
          await loadGridCells(session);
        }
        loadEvents(session);
      } catch (err) {
        if (resultEl) resultEl.textContent = 'Error executing preset.';
      }
      b.textContent = origText; b.disabled = false;
    });
  });

  // --- Broadcast to Ops ---
  document.getElementById('ctrl-broadcast-send')?.addEventListener('click', async () => {
    const msg = (document.getElementById('ctrl-broadcast-msg') as HTMLInputElement).value;
    if (!msg) return;
    await mFetch('/m/event', session, {
      method: 'POST',
      body: JSON.stringify({ event_type: 'mok_broadcast', payload: { message: msg, from: 'M' } }),
    });
    mokSend('directive', `Broadcast sent: ${msg.substring(0, 40)}`);
    (document.getElementById('ctrl-broadcast-msg') as HTMLInputElement).value = '';
    loadEvents(session);
  });
}

// --- Cell Panel ---
function renderCellPanel(ctrl: HTMLElement, session: Session, titleEl: HTMLElement | null) {
  const cell = cachedGridData?.cells.find((c) => c.cell_id === selectedCellId);
  if (!cell) { panelMode = 'overview'; renderRightPanel(session); return; }
  if (titleEl) titleEl.textContent = `CELL ${cell.cell_id}`;

  const st = cell.status || 'unknown';
  const tensionPct = cell.tension;
  const tensionColor = tensionPct < 40 ? 'var(--accent)' : tensionPct < 70 ? 'var(--amber)' : 'var(--red)';

  ctrl.innerHTML = `
    <div class="ctrl-stack">
      <div style="padding:4px 8px;">
        <div class="ctx-back" id="ctx-back">&#9664; BACK</div>
      </div>
      <div class="ctrl-section">
        <div class="ctx-header">${cell.cell_id}</div>
        <div class="ctx-stat"><span>STATUS</span><span class="status-badge st-${st}">${st.toUpperCase()}</span></div>
        <div class="ctx-stat"><span>LANE</span><span class="value">${cell.lane_id || '—'}</span></div>
        <div class="ctx-stat"><span>TENSION</span><span class="value" style="color:${tensionColor}">${tensionPct}%</span></div>
        <div class="tension-display"><div class="tension-fill" style="width:${tensionPct}%;background:${tensionColor}"></div></div>
      </div>
      <div class="ctrl-section">
        <div class="ctx-subtitle">ACTORS IN CELL</div>
        <div id="ctx-cell-actors" style="padding:2px 8px;">
          ${cell.actors && cell.actors.length ? cell.actors.map((a: any) =>
            `<div style="padding:2px 0;cursor:pointer;" class="ctx-actor-row" data-actor-id="${a.id}">
              <span class="actor-badge team-${a.team}">${a.callsign}</span>
              <span style="font-size:8px;color:#555;margin-left:4px;">${a.status}</span>
            </div>`
          ).join('') : '<div style="font-size:9px;color:var(--text-dim);padding:4px 0;">No actors</div>'}
        </div>
      </div>
      ${cell.dead_drops && cell.dead_drops.length ? `<div class="ctrl-section">
        <div class="ctx-subtitle">DEAD DROPS</div>
        <div style="padding:2px 8px;">
          ${cell.dead_drops.map((d: any) => `<div style="font-size:9px;"><span class="drop-marker">&#9670;</span> ${d.label} (${d.status})</div>`).join('')}
        </div>
      </div>` : ''}
      <div class="ctrl-section">
        <div class="ctx-subtitle">NOTES</div>
        <div style="padding:2px 8px;">
          <textarea class="ctx-notes" id="ctx-cell-notes" placeholder="Operational notes...">${cell.notes || ''}</textarea>
          <button class="ctrl-btn" id="ctx-save-notes" style="margin-top:2px;">SAVE NOTES</button>
        </div>
      </div>
      <div class="ctrl-section">
        <div class="ctx-subtitle">ACTIONS</div>
        <div class="ctx-actions">
          <button class="ctrl-btn" id="ctx-dispatch">DISPATCH ACTOR</button>
          <button class="ctrl-btn" id="ctx-resolve">MARK RESOLVED</button>
          <button class="ctrl-btn amber" id="ctx-tension-up">ESCALATE TENSION (+25)</button>
          ${cell.lane_id ? '<button class="ctrl-btn danger" id="ctx-freeze-lane">FREEZE LANE</button>' : ''}
          <button class="ctrl-btn amber" id="ctx-intel-drop">SEND INTEL DROP</button>
        </div>
      </div>
    </div>
  `;

  // Back
  document.getElementById('ctx-back')!.addEventListener('click', () => {
    panelMode = 'overview'; selectedCellId = null;
    refreshGridSelection(); renderRightPanel(session);
  });

  // Actor clicks
  ctrl.querySelectorAll('.ctx-actor-row[data-actor-id]').forEach((row) => {
    row.addEventListener('click', () => {
      selectedActorId = parseInt((row as HTMLElement).dataset.actorId!, 10);
      panelMode = 'actor';
      renderRightPanel(session);
    });
  });

  // Save notes
  document.getElementById('ctx-save-notes')!.addEventListener('click', async () => {
    const notes = (document.getElementById('ctx-cell-notes') as HTMLTextAreaElement).value;
    await mFetch('/m/cell', session, {
      method: 'PATCH',
      body: JSON.stringify({ scenario_id: session.scenarioId, cell_id: cell.cell_id, notes }),
    });
  });

  // Dispatch actor (show picker)
  document.getElementById('ctx-dispatch')!.addEventListener('click', () => {
    const allActors = cachedGridData?.unassigned_actors || [];
    const deployed = cachedGridData?.cells.flatMap((c) => c.actors) || [];
    const available = [...allActors, ...deployed];
    if (!available.length) return;

    const picker = document.createElement('div');
    picker.style.cssText = 'padding:4px 8px;';
    picker.innerHTML = `<div class="ctx-subtitle">SELECT ACTOR TO DISPATCH</div>` +
      available.map((a: any) =>
        `<div class="ctx-actor-row" data-pick-actor="${a.id}" style="padding:2px 0;cursor:pointer;">
          <span class="actor-badge team-${a.team}">${a.callsign}</span>
        </div>`
      ).join('');

    const actionsEl = ctrl.querySelector('.ctx-actions');
    if (actionsEl) actionsEl.replaceWith(picker);

    picker.querySelectorAll('[data-pick-actor]').forEach((el) => {
      el.addEventListener('click', async () => {
        const actorId = parseInt((el as HTMLElement).dataset.pickActor!, 10);
        await mFetch('/m/actor/move', session, {
          method: 'POST',
          body: JSON.stringify({ actor_id: actorId, cell_id: cell.cell_id }),
        });
        await loadGridCells(session);
        renderRightPanel(session);
      });
    });
  });

  // Mark resolved
  document.getElementById('ctx-resolve')!.addEventListener('click', async () => {
    await mFetch('/m/cell', session, {
      method: 'PATCH',
      body: JSON.stringify({ scenario_id: session.scenarioId, cell_id: cell.cell_id, status: 'working', tension: 0 }),
    });
    await loadGridCells(session);
    renderRightPanel(session);
  });

  // Escalate tension
  document.getElementById('ctx-tension-up')!.addEventListener('click', async () => {
    const newTension = Math.min(100, cell.tension + 25);
    await mFetch('/m/cell', session, {
      method: 'PATCH',
      body: JSON.stringify({ scenario_id: session.scenarioId, cell_id: cell.cell_id, tension: newTension }),
    });
    await loadGridCells(session);
    renderRightPanel(session);
  });

  // Freeze lane
  document.getElementById('ctx-freeze-lane')?.addEventListener('click', async () => {
    if (!cell.lane_id) return;
    const laneCells = cachedGridData?.cells.filter((c) => c.lane_id === cell.lane_id) || [];
    for (const lc of laneCells) {
      await mFetch('/m/cell', session, {
        method: 'PATCH',
        body: JSON.stringify({ scenario_id: session.scenarioId, cell_id: lc.cell_id, status: 'offline' }),
      });
    }
    await loadGridCells(session);
    renderRightPanel(session);
  });

  // Intel drop
  document.getElementById('ctx-intel-drop')!.addEventListener('click', async () => {
    await mFetch('/m/event', session, {
      method: 'POST',
      body: JSON.stringify({ event_type: 'intel_drop', payload: { message: `Intel drop at ${cell.cell_id}`, cell_id: cell.cell_id }, lane_id: cell.lane_id }),
    });
    loadEvents(session);
  });
}

// --- Actor Panel ---
function renderActorPanel(ctrl: HTMLElement, session: Session, titleEl: HTMLElement | null) {
  const allActors = [
    ...(cachedGridData?.cells.flatMap((c) => c.actors.map((a: any) => ({ ...a, cell_id: c.cell_id }))) || []),
    ...(cachedGridData?.unassigned_actors || []),
  ];
  const actor = allActors.find((a: any) => a.id === selectedActorId);
  if (!actor) { panelMode = 'cell'; renderRightPanel(session); return; }
  if (titleEl) titleEl.textContent = `ACTOR`;

  // Fetch recent pings for this actor
  let actorPingsHtml = '<div style="font-size:8px;color:var(--text-dim);">No recent pings.</div>';
  loadActorPings(session, actor.id).then((pingsHtml) => {
    const pingsEl = document.getElementById('ctx-actor-pings');
    if (pingsEl) pingsEl.innerHTML = pingsHtml;
  });

  ctrl.innerHTML = `
    <div class="ctrl-stack">
      <div style="padding:4px 8px;">
        <div class="ctx-back" id="ctx-back">&#9664; BACK TO CELL</div>
      </div>
      <div class="ctrl-section">
        <div class="ctx-header">${actor.callsign}</div>
        <div class="ctx-stat"><span>TEAM</span><span class="actor-badge team-${actor.team}">${actor.team.toUpperCase()}</span></div>
        <div class="ctx-stat"><span>STATUS</span><span class="value">${actor.status || 'standby'}</span></div>
        <div class="ctx-stat"><span>CELL</span><span class="value">${actor.cell_id || '—'}</span></div>
      </div>
      <div class="ctrl-section">
        <div class="ctx-subtitle">M PINGS</div>
        <div class="ctx-actions">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;">
            <button class="ctrl-btn" data-ping="MOVE">MOVE</button>
            <button class="ctrl-btn" data-ping="HOLD">HOLD</button>
            <button class="ctrl-btn" data-ping="ENGAGE">ENGAGE</button>
            <button class="ctrl-btn" data-ping="SHADOW">SHADOW</button>
            <button class="ctrl-btn amber" data-ping="DROP">DROP INTEL</button>
            <button class="ctrl-btn amber" data-ping="ESCALATE">ESCALATE</button>
            <button class="ctrl-btn danger" data-ping="EXTRACT">EXTRACT</button>
            <button class="ctrl-btn danger" data-ping="FREEZE">FREEZE</button>
          </div>
        </div>
      </div>
      <div class="ctrl-section">
        <div class="ctx-subtitle">PING HISTORY</div>
        <div id="ctx-actor-pings" style="max-height:80px;overflow-y:auto;padding:2px 0;">${actorPingsHtml}</div>
      </div>
      <div class="ctrl-section">
        <div class="ctx-subtitle">DIRECT COMMANDS</div>
        <div class="ctx-actions">
          <button class="ctrl-btn" id="ctx-actor-move">MOVE TO CELL</button>
          <button class="ctrl-btn danger" id="ctx-actor-dark">GO DARK</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('ctx-back')!.addEventListener('click', () => {
    panelMode = selectedCellId ? 'cell' : 'overview';
    renderRightPanel(session);
  });

  // Ping buttons
  ctrl.querySelectorAll('[data-ping]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const command = (btn as HTMLElement).dataset.ping!;
      const b = btn as HTMLButtonElement;
      b.textContent = 'SENDING...'; b.disabled = true;
      try {
        await mFetch('/m/ping', session, {
          method: 'POST',
          body: JSON.stringify({
            actor_id: actor.id,
            command,
            cell_id: actor.cell_id || selectedCellId || undefined,
          }),
        });
        mokSend('advisory', `Ping ${command} → ${actor.callsign}`);
        loadEvents(session);
        // Refresh ping history
        loadActorPings(session, actor.id).then((html) => {
          const el = document.getElementById('ctx-actor-pings');
          if (el) el.innerHTML = html;
        });
      } catch {}
      b.textContent = command; b.disabled = false;
    });
  });

  // Move: enter move mode
  document.getElementById('ctx-actor-move')!.addEventListener('click', () => {
    moveActorId = actor.id;
    panelMode = 'move_actor';
    renderRightPanel(session);
  });

  // Go dark
  document.getElementById('ctx-actor-dark')!.addEventListener('click', async () => {
    await mFetch('/m/actor/command', session, {
      method: 'POST',
      body: JSON.stringify({ actor_id: actor.id, command: 'go_dark' }),
    });
    await loadGridCells(session);
    loadEvents(session);
    renderRightPanel(session);
  });
}

// --- Load Actor Pings for Ping History ---
async function loadActorPings(session: Session, actorId: number): Promise<string> {
  try {
    const res = await mFetch(`/m/pings/${session.scenarioId}?limit=50`, session);
    if (!res.ok) return '<div style="font-size:8px;color:var(--text-dim);">Error loading pings.</div>';
    const data = await res.json() as any;
    const pings = (data.pings || []).filter((p: any) => p.payload?.target_actor_id === actorId);
    if (!pings.length) return '<div style="font-size:8px;color:var(--text-dim);">No pings sent.</div>';
    return pings.slice(0, 8).map((p: any) => {
      const cmd = p.payload?.ping_command || '?';
      const ts = new Date(p.created_at).toLocaleTimeString();
      const acked = p.ack;
      const ackTime = acked ? Math.round((new Date(acked.created_at).getTime() - new Date(p.created_at).getTime()) / 1000) : null;
      return `<div style="font-size:8px;padding:1px 0;border-bottom:1px solid rgba(40,40,40,0.3);display:flex;justify-content:space-between;">
        <span style="color:${acked ? 'var(--accent)' : 'var(--amber)'}">${cmd}</span>
        <span style="color:#444;">${ts} ${acked ? `ACK ${ackTime}s` : 'PENDING'}</span>
      </div>`;
    }).join('');
  } catch {
    return '<div style="font-size:8px;color:var(--text-dim);">Error.</div>';
  }
}

// --- Move Actor Panel ---
function renderMoveActorPanel(ctrl: HTMLElement, session: Session, titleEl: HTMLElement | null) {
  if (titleEl) titleEl.textContent = 'MOVE ACTOR';
  ctrl.innerHTML = `
    <div class="ctrl-stack">
      <div style="padding:4px 8px;">
        <div class="ctx-back" id="ctx-back">&#9664; CANCEL</div>
      </div>
      <div class="ctrl-section">
        <div class="move-mode-banner">CLICK A CELL ON THE MAP TO MOVE ACTOR</div>
      </div>
    </div>
  `;
  document.getElementById('ctx-back')!.addEventListener('click', () => {
    panelMode = 'actor'; moveActorId = null;
    renderRightPanel(session);
  });
}

async function doMoveActor(actorId: number, cellId: string, session: Session) {
  await mFetch('/m/actor/move', session, {
    method: 'POST',
    body: JSON.stringify({ actor_id: actorId, cell_id: cellId }),
  });
  moveActorId = null;
  selectedCellId = cellId;
  panelMode = 'cell';
  await loadGridCells(session);
  loadEvents(session);
  renderRightPanel(session);
}

// --- Assign Lane Panel ---
function renderAssignLanePanel(ctrl: HTMLElement, session: Session, titleEl: HTMLElement | null) {
  if (titleEl) titleEl.textContent = `ASSIGN: ${selectedLaneId}`;
  const laneCells = cachedGridData?.cells.filter((c) => c.lane_id === selectedLaneId) || [];
  ctrl.innerHTML = `
    <div class="ctrl-stack">
      <div style="padding:4px 8px;">
        <div class="ctx-back" id="ctx-back">&#9664; DONE</div>
      </div>
      <div class="ctrl-section">
        <div class="move-mode-banner" style="border-color:var(--amber);color:var(--amber);">CLICK CELLS TO ADD/REMOVE FROM LANE ${selectedLaneId}</div>
        <div class="ctx-stat" style="margin-top:4px;"><span>CELLS IN LANE</span><span class="value">${laneCells.length}</span></div>
      </div>
    </div>
  `;
  document.getElementById('ctx-back')!.addEventListener('click', () => {
    panelMode = 'overview'; selectedLaneId = null;
    renderRightPanel(session);
    loadGridCells(session);
  });
}

// --- Populate lane dropdown ---
async function populateLaneSelect(selectId: string, session: Session) {
  try {
    const res = await mFetch(`/m/grid/${session.scenarioId}`, session);
    if (!res.ok) return;
    const data = await res.json() as any;
    const sel = document.getElementById(selectId) as unknown as HTMLSelectElement;
    if (!sel) return;
    const lanes = data.lanes || [];
    sel.innerHTML = '<option value="">— select lane —</option>' +
      lanes.map((l: any) => `<option value="${l.lane_id}">${l.label || l.lane_id}</option>`).join('');
  } catch {}
}

// --- Freeze ---
async function toggleFreeze(session: Session) {
  try {
    const res = await mFetch('/m/scenario/freeze', session, {
      method: 'POST',
      body: JSON.stringify({ scenario_id: session.scenarioId }),
    });
    if (res.ok) {
      await loadGridCells(session);
      loadEvents(session);
    }
  } catch {}
}

// --- WebSocket ---
function connectWS(session: Session) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    const ws = new WebSocket(`${proto}//${location.host}/api/m/ws`);
    ws.onopen = () => {
      const dot = document.getElementById('m-ws-dot');
      if (dot) { dot.classList.add('on'); dot.title = 'LIVE'; }
    };
    ws.onmessage = (ev) => {
      loadGridCells(session);
      loadEvents(session);
      // Flash MOK on incoming events
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'event') {
          const evType = data.data?.event_type || '';
          if (evType === 'escalation' || evType === 'dead_drop_compromised') {
            mokSend('warning', `${evType.replace(/_/g, ' ')} detected.`);
          } else if (evType === 'checkin') {
            mokSend('advisory', `Check-in: ${data.data?.payload?.callsign || 'unknown'}`);
          } else if (evType === 'actor_panic') {
            const p = data.data?.payload || {};
            mokSend('critical', `⚠ PANIC — ${p.callsign || 'ACTOR'}: ${p.message || 'ABORT'}`);
          } else if (evType === 'player_pingback') {
            mokSend('advisory', `Pingback from ${data.data?.payload?.callsign || 'player'}.`);
          }
        } else if (data.type === 'actor_telemetry') {
          // Live GPS update from watch app — update telemetry list if visible
          const td = data.data as any;
          if (td) {
            const listEl = document.getElementById('actor-telemetry-list');
            if (listEl && cachedSession) loadActorPositions(cachedSession);
          }
        } else if (data.type === 'mping_ack') {
          const callsign = data.data?.acked_by || 'unknown';
          mokSend('advisory', `ACK received from ${callsign}.`);
          // Refresh actor panel if we're looking at that actor
          if (panelMode === 'actor' && cachedSession) renderRightPanel(cachedSession);
        } else if (data.type === 'state' && data.data?.frozen !== undefined) {
          mokSend('critical', data.data.frozen ? 'GAME FROZEN by command.' : 'Game UNFROZEN — resume ops.');
        }
      } catch {}
    };
    ws.onclose = () => {
      const dot = document.getElementById('m-ws-dot');
      if (dot) { dot.classList.remove('on'); dot.title = 'OFFLINE'; }
      setTimeout(() => connectWS(session), 3000);
    };
    ws.onerror = () => ws.close();
  } catch {}
}
