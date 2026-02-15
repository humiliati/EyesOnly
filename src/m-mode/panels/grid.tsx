/* ============================================================
   EYES ONLY — M Mode: Grid Panel
   Interactive SVG lane grid with actor positions and dead drops.
   ============================================================ */

import { useState, useEffect } from 'preact/hooks';
import { getState, subscribe, selectLane } from '../store';
import type { Lane, Actor } from '../store';

const COLORS: Record<string, string> = {
  red: '#ff3333', blue: '#3399ff', director: '#ffaa33',
};
const LANE_PALETTE = ['#33ff33', '#3399ff', '#ffaa33', '#ff33ff', '#33ffff', '#ff3333', '#ffff33', '#aa33ff'];

export function GridPanel() {
  const [s, setS] = useState(getState());
  useEffect(() => subscribe(() => setS(getState())), []);

  const { lanes, unassignedActors, selectedLane } = s;
  if (lanes.length === 0) {
    return <div style={{ color: '#444', padding: '20px', textAlign: 'center' }}>NO LANES — ADD LANES IN CONTROL PANEL</div>;
  }

  const W = 460;
  const laneH = 56;
  const pad = 16;
  const H = lanes.length * laneH + pad * 2 + 20;

  return (
    <div class="grid-panel">
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <rect width={W} height={H} fill="#0a0a0a" />

        {lanes.map((lane, i) => {
          const y = pad + i * laneH + laneH / 2;
          const col = LANE_PALETTE[i % LANE_PALETTE.length];
          const sel = selectedLane === lane.lane_id;

          return (
            <g key={lane.lane_id} style={{ cursor: 'pointer' }} onClick={() => selectLane(sel ? null : lane.lane_id)}>
              {/* Selection highlight */}
              {sel && (
                <rect x={0} y={y - laneH / 2 + 2} width={W} height={laneH - 4}
                  fill={col} opacity={0.06} />
              )}

              {/* Track */}
              <line x1={pad} y1={y} x2={W - pad} y2={y}
                stroke={col} stroke-width={sel ? 3 : 2} opacity={sel ? 1 : 0.5} />

              {/* Lane label */}
              <text x={pad + 4} y={y - 10} fill={sel ? col : '#555'}
                font-size="9" font-family="'Courier New', monospace" letter-spacing="1">
                {lane.lane_id}
              </text>
              <text x={pad + 4} y={y + 16} fill={sel ? col : '#333'}
                font-size="10" font-family="'Courier New', monospace">
                {lane.label}
              </text>

              {/* Actors on this lane */}
              {lane.actors.map((actor, ai) => {
                const ax = 140 + ai * 50;
                const aCol = COLORS[actor.team] || '#888';
                return (
                  <g key={actor.id}>
                    <circle cx={ax} cy={y} r={7} fill="#0a0a0a" stroke={aCol} stroke-width={2} />
                    <text x={ax} y={y + 3} fill={aCol}
                      font-size="6" font-family="'Courier New', monospace"
                      text-anchor="middle" font-weight="bold">
                      {actor.callsign.slice(0, 2).toUpperCase()}
                    </text>
                    <text x={ax} y={y + 22} fill="#444"
                      font-size="7" font-family="'Courier New', monospace" text-anchor="middle">
                      {actor.callsign}
                    </text>
                  </g>
                );
              })}

              {/* Dead drops */}
              {lane.dead_drops.map((dd, di) => {
                const dx = W - pad - 30 - di * 25;
                const ddCol = dd.status === 'retrieved' ? '#333' : (dd.status === 'compromised' ? '#ff3333' : '#ffaa33');
                return (
                  <g key={dd.id}>
                    <rect x={dx - 5} y={y - 5} width={10} height={10}
                      fill="none" stroke={ddCol} stroke-width={1.5}
                      transform={`rotate(45 ${dx} ${y})`} />
                    <text x={dx} y={y + 18} fill="#444"
                      font-size="6" font-family="'Courier New', monospace" text-anchor="middle">
                      {dd.status.slice(0, 3).toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Unassigned actors bar */}
        {unassignedActors.length > 0 && (
          <g>
            <text x={pad} y={H - 10} fill="#444"
              font-size="8" font-family="'Courier New', monospace" letter-spacing="1">
              UNASSIGNED: {unassignedActors.map((a) => a.callsign).join(', ')}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
