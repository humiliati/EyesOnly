/* ============================================================
   EYES ONLY — Ops UI: Map Screen
   Read-only UGRS tactical grid with scenario nodes overlay.
   ============================================================ */

import { useState, useEffect, useRef } from 'preact/hooks';
import { getState, subscribe, fetchMapData, getMapData } from '../store';
import type { MapData } from '../store';

const NODE_ICONS: Record<string, string> = {
  waypoint: '\u2605',    // ★
  objective: '\u2691',   // ⚑
  trigger: '\u26A1',     // ⚡
  spawn: '\u25CF',       // ●
  hazard: '\u26A0',      // ⚠
  'intel-drop': '\u2666' // ♦
};
const NODE_COLORS: Record<string, string> = {
  pending: '#555', active: '#33ff33', completed: '#3399ff', failed: '#ff3333'
};
const STATUS_BG: Record<string, string> = {
  working: 'rgba(51,255,51,0.06)',
  degraded: 'rgba(255,170,51,0.10)',
  compromised: 'rgba(255,51,51,0.10)',
  offline: 'rgba(100,100,100,0.08)',
  unknown: 'rgba(0,0,0,0.2)',
};
const STATUS_BORDER: Record<string, string> = {
  working: 'rgba(51,255,51,0.25)',
  degraded: 'rgba(255,170,51,0.35)',
  compromised: 'rgba(255,51,51,0.35)',
  offline: 'rgba(100,100,100,0.3)',
  unknown: 'rgba(40,40,40,0.5)',
};

export function MapScreen() {
  const [state, setState] = useState(getState());
  const [mapData, setMapData] = useState<MapData | null>(getMapData());

  useEffect(() => {
    fetchMapData();
    const unsub = subscribe(() => {
      setState(getState());
      setMapData(getMapData());
    });
    // Refresh map every 15 seconds
    const interval = setInterval(() => fetchMapData(), 15000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  if (!mapData || !mapData.grid) {
    return (
      <div class="screen">
        <div class="card" style={{ flex: 0 }}>
          <h2>TACTICAL MAP</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            {state.scenario?.name || 'NO SCENARIO'}
          </div>
        </div>
        <div class="loading">
          NO GRID DATA AVAILABLE
          <br />
          <span style={{ fontSize: '11px' }}>AWAITING MAP CONFIGURATION FROM M</span>
        </div>
      </div>
    );
  }

  const { grid, cells, nodes, map_url } = mapData;
  const cols = grid.cols;
  const rows = grid.rows;
  const colLabels = grid.col_labels || [];
  const rowLabels = grid.row_labels || [];

  return (
    <div class="screen" style={{ padding: '4px', overflow: 'auto' }}>
      <div style={{ position: 'relative' }}>
        {map_url && (
          <img
            src={map_url}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain', opacity: 0.25,
              pointerEvents: 'none',
            }}
          />
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `24px repeat(${cols}, 1fr)`,
          gridTemplateRows: `20px repeat(${rows}, 1fr)`,
          gap: '1px',
          padding: '4px',
          position: 'relative',
          zIndex: 1,
          minHeight: '300px',
        }}>
          {/* Corner spacer */}
          <div />

          {/* Column headers */}
          {Array.from({ length: cols }, (_, c) => (
            <div key={`ch-${c}`} style={{
              fontSize: '8px', color: '#555', textAlign: 'center',
              padding: '2px 0', letterSpacing: '1px',
            }}>
              {colLabels[c] || String.fromCharCode(65 + c)}
            </div>
          ))}

          {/* Rows */}
          {Array.from({ length: rows }, (_, r) => {
            const rowLabel = rowLabels[r] || String(r + 1);
            return [
              <div key={`rh-${r}`} style={{
                fontSize: '8px', color: '#555',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                letterSpacing: '1px',
              }}>
                {rowLabel}
              </div>,
              ...Array.from({ length: cols }, (_, c) => {
                const colLabel = colLabels[c] || String.fromCharCode(65 + c);
                const cellId = `${colLabel}${rowLabel}`;
                const cell = cells.find((cl) => cl.cell_id === cellId);
                const st = cell?.status || 'unknown';
                const cellNodes = nodes.filter((n) => n.cell_id === cellId);
                const tension = cell?.tension || 0;

                return (
                  <div key={cellId} style={{
                    position: 'relative',
                    border: `1px ${cellNodes.length ? 'dashed' : 'solid'} ${STATUS_BORDER[st] || STATUS_BORDER.unknown}`,
                    background: STATUS_BG[st] || STATUS_BG.unknown,
                    padding: '3px 4px',
                    minHeight: '36px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    fontSize: '8px',
                  }}>
                    <span style={{ fontSize: '7px', color: '#444', position: 'absolute', top: 1, left: 3 }}>
                      {cellId}
                    </span>

                    {/* Scenario nodes */}
                    <div style={{ marginTop: '10px', flex: 1 }}>
                      {cellNodes.map((n) => (
                        <span
                          key={n.id}
                          title={`${n.type}: ${n.label} [${n.status}]`}
                          style={{
                            display: 'inline-block',
                            fontSize: '10px',
                            color: NODE_COLORS[n.status] || '#555',
                            margin: '1px',
                          }}
                        >
                          {NODE_ICONS[n.type] || '\u25CF'}
                        </span>
                      ))}
                    </div>

                    {/* Tension bar */}
                    {tension > 0 && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0,
                        height: '2px', width: `${tension}%`,
                        background: tension < 40 ? '#33ff33' : tension < 70 ? '#ffaa33' : '#ff3333',
                        transition: 'width 0.3s',
                      }} />
                    )}
                  </div>
                );
              }),
            ];
          }).flat()}
        </div>
      </div>
    </div>
  );
}
