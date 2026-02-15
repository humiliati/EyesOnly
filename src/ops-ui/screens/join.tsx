/* ============================================================
   EYES ONLY — Ops UI: Join Screen
   Enter a join code + callsign to connect to a live scenario.
   ============================================================ */

import { useState } from 'preact/hooks';
import { join, getState } from '../store';

export function JoinScreen() {
  const [code, setCode] = useState('');
  const [callsign, setCallsign] = useState('');
  const state = getState();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!code.trim() || !callsign.trim()) return;
    await join(code.trim().toUpperCase(), callsign.trim());
  };

  return (
    <div class="join-screen">
      <div class="logo">EYES ONLY</div>
      <div class="subtitle">FIELD OPERATIONS TERMINAL</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
        <div class="field">
          <label>JOIN CODE</label>
          <input
            type="text"
            value={code}
            onInput={(e) => setCode((e.target as HTMLInputElement).value)}
            placeholder="ALPHA7"
            autocomplete="off"
            autocapitalize="characters"
          />
        </div>

        <div class="field">
          <label>CALLSIGN</label>
          <input
            type="text"
            value={callsign}
            onInput={(e) => setCallsign((e.target as HTMLInputElement).value)}
            placeholder="OPERATIVE"
            autocomplete="off"
          />
        </div>

        {state.error && <div class="error-msg">{state.error}</div>}

        <button
          type="submit"
          class="btn"
          disabled={state.loading || !code.trim() || !callsign.trim()}
        >
          {state.loading ? 'CONNECTING...' : 'JOIN SCENARIO'}
        </button>
      </form>

      <div class="subtitle" style={{ marginTop: '20px' }}>
        OBTAIN A JOIN CODE FROM YOUR HANDLER
      </div>
    </div>
  );
}
