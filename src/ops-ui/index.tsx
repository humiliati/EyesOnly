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

try {
  render(<App />, document.getElementById('app')!);
} catch (e) {
  const el = document.getElementById('app');
  if (el) {
    el.innerHTML = `<div style="color:#ff3333;font-family:monospace;padding:40px;text-align:center;">
      <div style="font-size:14px;margin-bottom:8px;">RENDER FAULT</div>
      <div style="font-size:11px;color:#aa2222;word-break:break-all;">${e}</div>
    </div>`;
  }
}
