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

// Plain DOM fallback for when SES/lockdown breaks Preact
function renderWithDOM(container: HTMLElement) {
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
    btn.textContent = 'AUTHENTICATING...';
    btn.disabled = true;
    errEl.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callsign, password, scenario_id: parseInt(scenarioId, 10) || 1 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as any;
        throw new Error(data.message || 'Login failed');
      }
      const data = await res.json() as any;
      if (data.actor?.team !== 'director') throw new Error('Director access required');

      // Store session and reload to enter full app
      localStorage.setItem('eyesonly_mmode_session', JSON.stringify({
        token: data.token, callsign: data.actor.callsign, scenarioId: data.actor.scenario_id,
      }));
      errEl.textContent = 'AUTHENTICATED — LOADING...';
      errEl.style.display = '';
      errEl.style.color = 'var(--accent)';
      // For now, just show success — the full director console needs Preact
      setTimeout(() => { window.location.reload(); }, 500);
    } catch (err: any) {
      errEl.textContent = err.message || 'Network error';
      errEl.style.display = '';
      btn.textContent = 'AUTHENTICATE';
      btn.disabled = false;
    }
  });

  overlay.appendChild(box);
  container.appendChild(overlay);
}
