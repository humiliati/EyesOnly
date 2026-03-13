/* ============================================================
   EYES ONLY — Ops UI: Dashboard Screen
   Scenario status, check-in button, recent activity.
   ============================================================ */

import { useState, useEffect, useRef } from 'preact/hooks';
import { getState, subscribe, checkin, disconnect, fetchScenario } from '../store';

export function DashboardScreen() {
  const [state, setState] = useState(getState());
  const [checkinMsg, setCheckinMsg] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);
  const [intelVideo, setIntelVideo] = useState<{ url: string; title: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchScenario();
    const unsub = subscribe(() => setState(getState()));

    // Listen for video push events dispatched by store.ts
    const handleVideo = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.video_url) {
        setIntelVideo({ url: detail.video_url, title: detail.title || 'INTEL' });
      }
    };
    window.addEventListener('ops:video_push', handleVideo);
    return () => {
      unsub();
      window.removeEventListener('ops:video_push', handleVideo);
    };
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

  const replayIntel = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div class="screen">
      {/* INTEL FEED — receives video push from M */}
      <div class="card" style={{ borderColor: intelVideo ? 'var(--red)' : 'var(--border)', borderWidth: intelVideo ? '1px' : undefined, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ color: 'var(--red)', margin: 0 }}>INTEL FEED</h2>
          <span style={{ fontSize: '9px', letterSpacing: '1px', color: intelVideo ? 'var(--red)' : '#555' }}>
            {intelVideo ? '● RECEIVED' : 'AWAITING INTEL'}
          </span>
        </div>
        <div style={{ marginTop: '8px', minHeight: '40px' }}>
          {intelVideo ? (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', letterSpacing: '1px', marginBottom: '6px', textTransform: 'uppercase' }}>{intelVideo.title}</div>
              <div style={{ position: 'relative', background: '#000', borderRadius: '4px', overflow: 'hidden' }}>
                <video
                  ref={videoRef}
                  src={intelVideo.url}
                  playsinline
                  preload="metadata"
                  style={{ width: '100%', maxHeight: '180px', display: 'block', objectFit: 'contain' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                <button class="btn" style={{ flex: 1, padding: '8px', fontSize: '10px', minHeight: '36px' }} onClick={replayIntel}>&#9654; REPLAY</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
              <span style={{ color: 'var(--red)', fontSize: '10px', letterSpacing: '2px' }}>&#9656;</span> Video intel from M will appear here
            </div>
          )}
        </div>
      </div>

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
    case 'video_push':
      return `VIDEO INTEL: ${p.title || 'incoming'}`;
    default:
      return `${ev.event_type}: ${JSON.stringify(p).slice(0, 60)}`;
  }
}
