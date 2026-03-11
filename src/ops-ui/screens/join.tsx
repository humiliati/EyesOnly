/* ============================================================
   EYES ONLY — Ops UI: Join Screen
   Login with username, then enter a join code to connect.
   ============================================================ */

import { useState } from 'preact/hooks';
import { join, getState, getUserSessionToken, getUserInfo, userLogin } from '../store';

export function JoinScreen() {
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const state = getState();

  // Check if user is already logged in (from main site or previous ops login)
  const existingToken = getUserSessionToken();
  const existingUser = getUserInfo();
  const isLoggedIn = !!existingToken && !!existingUser;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!code.trim()) return;

    if (isLoggedIn) {
      // Already have a user session — go straight to join
      await join(code.trim().toUpperCase(), existingToken!);
    } else {
      // Need to login/register first, then join
      if (!username.trim()) return;
      const token = await userLogin(username.trim().toLowerCase());
      if (token) {
        await join(code.trim().toUpperCase(), token);
      }
    }
  };

  return (
    <div class="join-screen">
      <div class="logo">EYES ONLY</div>
      <div class="subtitle">FIELD OPERATIONS TERMINAL</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
        {isLoggedIn ? (
          <div class="field" style={{ textAlign: 'center' }}>
            <label style={{ color: '#33ff33', letterSpacing: '2px' }}>LOGGED IN AS</label>
            <div style={{ fontSize: '16px', color: '#33ff33', letterSpacing: '2px', padding: '8px 0' }}>
              {existingUser!.callsign || existingUser!.username}
            </div>
          </div>
        ) : (
          <div class="field">
            <label>USERNAME</label>
            <input
              type="text"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              placeholder="Enter username or register new"
              autocomplete="username"
            />
          </div>
        )}

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

        {state.error && <div class="error-msg">{state.error}</div>}

        <button
          type="submit"
          class="btn"
          disabled={state.loading || !code.trim() || (!isLoggedIn && !username.trim())}
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
