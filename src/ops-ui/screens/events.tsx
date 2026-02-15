/* ============================================================
   EYES ONLY — Ops UI: Events Screen
   Scrolling feed of all scenario events.
   ============================================================ */

import { useState, useEffect } from 'preact/hooks';
import { getState, subscribe, fetchEvents } from '../store';
import type { OpsEvent } from '../store';

export function EventsScreen() {
  const [state, setState] = useState(getState());

  useEffect(() => {
    fetchEvents();
    return subscribe(() => setState(getState()));
  }, []);

  return (
    <div class="screen">
      <div class="card" style={{ flex: 0 }}>
        <h2>EVENT LOG — {state.events.length} ENTRIES</h2>
      </div>

      <div class="events" style={{ flex: 1 }}>
        {state.events.length === 0 && (
          <div class="loading">NO EVENTS RECORDED</div>
        )}
        {state.events.map((ev) => (
          <EventItem key={ev.id || ev.created_at} event={ev} />
        ))}
      </div>
    </div>
  );
}

function EventItem({ event }: { event: OpsEvent }) {
  const p = event.payload;
  const typeClass = event.event_type.startsWith('dead_drop') ? 'dead_drop' : event.event_type;

  return (
    <div class={`event-item ${typeClass}`}>
      <div>
        <span class="time">{formatTime(event.created_at)}</span>
        {' '}
        <strong style={{ fontSize: '11px', letterSpacing: '1px' }}>
          {event.event_type.toUpperCase().replace(/_/g, ' ')}
        </strong>
      </div>
      <div style={{ marginTop: '2px', color: 'var(--text-dim)', fontSize: '11px' }}>
        {formatPayload(event)}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatPayload(ev: OpsEvent): string {
  const p = ev.payload;
  switch (ev.event_type) {
    case 'checkin':
      return `${p.callsign || 'OPERATIVE'}${p.message ? ' — ' + p.message : ''}${p.lat ? ` [${(p.lat as number).toFixed(4)}, ${(p.lng as number).toFixed(4)}]` : ''}`;
    case 'dead_drop_placed':
      return `${p.callsign || 'OPERATIVE'} placed drop in lane ${p.lane_id || '?'}${p.label ? ' (' + p.label + ')' : ''}`;
    case 'dead_drop_retrieved':
      return `${p.callsign || 'OPERATIVE'} retrieved drop from lane ${p.lane_id || '?'}`;
    case 'escalation':
      return `Tier ${p.tier}${p.triggered_by ? ' by ' + p.triggered_by : ''}${p.message ? ' — ' + p.message : ''}`;
    default: {
      const str = JSON.stringify(p);
      return str.length > 80 ? str.slice(0, 80) + '...' : str;
    }
  }
}
