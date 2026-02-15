/* ============================================================
   EYES ONLY — Ops UI: Map Screen
   Subway-style lane grid visualization (SVG).
   ============================================================ */

import { useState, useEffect } from 'preact/hooks';
import { getState, subscribe, fetchScenario } from '../store';
import { LaneGrid } from '../components/lane-grid';

export function MapScreen() {
  const [state, setState] = useState(getState());

  useEffect(() => {
    fetchScenario();
    return subscribe(() => setState(getState()));
  }, []);

  return (
    <div class="screen">
      <div class="card" style={{ flex: 0 }}>
        <h2>OPERATIONAL MAP</h2>
        {state.scenario && (
          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            {state.scenario.name} — {state.lanes.length} LANES
          </div>
        )}
      </div>

      {state.lanes.length === 0 ? (
        <div class="loading">
          NO LANE DATA AVAILABLE
          <br />
          <span style={{ fontSize: '11px' }}>AWAITING SCENARIO CONFIGURATION</span>
        </div>
      ) : (
        <LaneGrid
          lanes={state.lanes}
          actorLane={state.actor?.lane_id}
        />
      )}
    </div>
  );
}
