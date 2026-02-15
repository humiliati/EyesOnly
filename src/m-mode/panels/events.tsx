/* ============================================================
   EYES ONLY — M Mode: Events Panel
   Real-time scrolling event feed with filtering.
   ============================================================ */

import { useState, useEffect, useRef } from 'preact/hooks';
import { getState, subscribe, fetchEventLog } from '../store';
import type { MEvent } from '../store';

export function EventsPanel() {
  const [s, setS] = useState(getState());
  const [filter, setFilter] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (s.scenarioId) fetchEventLog(s.scenarioId);
    return subscribe(() => setS(getState()));
  }, []);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [s.events.length]);

  const filtered = filter
    ? s.events.filter((e) =>
        e.event_type.includes(filter) ||
        JSON.stringify(e.payload).toLowerCase().includes(filter.toLowerCase())
      )
    : s.events;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{ marginBottom: '4px', flexShrink: 0 }}>
        <input
          type="text"
          value={filter}
          onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
          placeholder="FILTER EVENTS..."
          style={{
            width: '100%',
            background: '#0a0a0a', border: '1px solid #222',
            color: '#33ff33', fontFamily: "'Courier New', monospace",
            fontSize: '10px', padding: '3px 6px', borderRadius: '2px',
            outline: 'none',
          }}
        />
      </div>

      {/* Feed */}
      <div class="feed" ref={feedRef} style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ color: '#333', padding: '8px', textAlign: 'center', fontSize: '10px' }}>
            {s.events.length === 0 ? 'NO EVENTS' : 'NO MATCHING EVENTS'}
          </div>
        )}
        {filtered.map((ev, i) => (
          <FeedItem key={ev.id || i} event={ev} />
        ))}
      </div>
    </div>
  );
}

function FeedItem({ event }: { event: MEvent }) {
  const p = event.payload;
  const typeClass = event.event_type.startsWith('dead_drop') ? event.event_type : event.event_type;

  return (
    <div class={`feed-item ${typeClass}`}>
      <span class="ts">{fmtTime(event.created_at)}</span>
      <strong style={{ letterSpacing: '0.5px' }}>
        {event.event_type.toUpperCase().replace(/_/g, ' ')}
      </strong>
      {p.callsign && <span class="actor"> [{p.callsign as string}]</span>}
      {p.lane_id && <span style={{ color: '#555' }}> LANE:{p.lane_id as string}</span>}
      {p.message && <span style={{ color: '#666' }}> — {p.message as string}</span>}
      {p.tier !== undefined && <span style={{ color: '#ff3333' }}> TIER {p.tier as number}</span>}
    </div>
  );
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
