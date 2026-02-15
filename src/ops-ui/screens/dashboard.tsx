/* ============================================================
   EYES ONLY — Ops UI: Dashboard Screen
   Scenario status, check-in button, recent activity.
   ============================================================ */

import { useState, useEffect } from 'preact/hooks';
import { getState, subscribe, checkin, disconnect, fetchScenario } from '../store';

export function DashboardScreen() {
  const [state, setState] = useState(getState());
  const [checkinMsg, setCheckinMsg] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    fetchScenario();
    return subscribe(() => setState(getState()));
  }, []);

  const handleCheckin = async () => {
    const ok = await checkin(checkinMsg || undefined);
    if (ok) {
      setCheckedIn(true);
      setCheckinMsg('');
      setTimeout(() => setCheckedIn(false), 3000);
    }
  };

  const scenario = state.scenario;
  const actor = state.actor;

  return (
    <div class="screen">
      {/* Status cards */}
      <div class="stat-row">
        <div class="card">
          <h2>SCENARIO</h2>
          <div class="value">{scenario ? scenario.name : '—'}</div>
        </div>
        <div class="card">
          <h2>STATUS</h2>
          <div class="value" style={{ color: scenario?.status === 'active' ? 'var(--accent)' : 'var(--amber)' }}>
            {scenario ? scenario.status.toUpperCase() : '—'}
          </div>
        </div>
      </div>

      <div class="stat-row">
        <div class="card">
          <h2>CALLSIGN</h2>
          <div class="value">{actor?.callsign || '—'}</div>
        </div>
        <div class="card">
          <h2>TEAM</h2>
          <div class="value">{actor?.team?.toUpperCase() || '—'}</div>
        </div>
      </div>

      {actor?.lane_id && (
        <div class="card">
          <h2>ASSIGNED LANE</h2>
          <div class="value">{actor.lane_id}</div>
        </div>
      )}

      {/* Check-in */}
      <div class="card">
        <h2>FIELD CHECK-IN</h2>
        <div class="field" style={{ maxWidth: '100%', marginTop: '8px' }}>
          <input
            type="text"
            value={checkinMsg}
            onInput={(e) => setCheckinMsg((e.target as HTMLInputElement).value)}
            placeholder="Optional status message..."
          />
        </div>
        <button
          class="btn"
          style={{ maxWidth: '100%', marginTop: '8px' }}
          onClick={handleCheckin}
          disabled={state.loading}
        >
          {state.loading ? 'TRANSMITTING...' : checkedIn ? 'CHECK-IN CONFIRMED' : 'CHECK IN'}
        </button>
      </div>

      {/* Recent events */}
      {state.events.length > 0 && (
        <div class="card">
          <h2>RECENT ACTIVITY</h2>
          <div class="events" style={{ maxHeight: '150px' }}>
            {state.events.slice(-5).reverse().map((ev) => (
              <div class={`event-item ${ev.event_type}`} key={ev.id || ev.created_at}>
                <span class="time">{formatTime(ev.created_at)}</span>{' '}
                {formatEvent(ev)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection info */}
      <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '16px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '8px' }}>
          {state.wsConnected ? (
            <span>LIVE FEED <span class="blink">●</span></span>
          ) : (
            <span style={{ color: 'var(--red)' }}>FEED OFFLINE</span>
          )}
        </div>
        <button class="btn danger" style={{ maxWidth: '200px', fontSize: '11px', padding: '8px 16px' }} onClick={disconnect}>
          DISCONNECT
        </button>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatEvent(ev: { event_type: string; payload: Record<string, unknown> }): string {
  const p = ev.payload;
  switch (ev.event_type) {
    case 'checkin':
      return `${p.callsign || 'OPERATIVE'} checked in${p.message ? ': ' + p.message : ''}`;
    case 'dead_drop_placed':
      return `${p.callsign || 'OPERATIVE'} placed dead drop [${p.lane_id || '?'}]`;
    case 'dead_drop_retrieved':
      return `${p.callsign || 'OPERATIVE'} retrieved dead drop [${p.lane_id || '?'}]`;
    case 'escalation':
      return `ESCALATION TIER ${p.tier}${p.message ? ': ' + p.message : ''}`;
    default:
      return `${ev.event_type}: ${JSON.stringify(p).slice(0, 60)}`;
  }
}
