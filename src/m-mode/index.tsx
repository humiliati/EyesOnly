/* ============================================================
   EYES ONLY — M Mode Director Console Entry Point
   3-panel real-time scenario management.
   ============================================================ */

import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { getState, subscribe, init, login, logout } from './store';
import { GridPanel } from './panels/grid';
import { EventsPanel } from './panels/events';
import { ControlPanel } from './panels/control';

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

render(<App />, document.getElementById('app')!);
