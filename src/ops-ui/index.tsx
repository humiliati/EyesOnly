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

function renderOpsWithDOM(container: HTMLElement) {
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
      localStorage.setItem('eyesonly_ops_session', JSON.stringify({ token: data.token, actor: data.actor }));
      errEl.textContent = 'JOINED — LOADING...'; errEl.style.display = ''; errEl.style.color = 'var(--accent)';
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      errEl.textContent = err.message || 'Network error'; errEl.style.display = '';
      btn.textContent = 'JOIN OPERATION'; btn.disabled = false;
    }
  });
  container.appendChild(screen);
}
