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

const target = document.getElementById('app');
if (target) {
  target.innerHTML = '';

  // Test if Preact render works (SES lockdown can silently break it)
  render(<div id="test-ops">OK</div>, target);
  if (target.children.length === 0) {
    console.warn('[OPS] Preact render broken, falling back to DOM');
    target.innerHTML = '';
    renderOpsWithDOM(target);
  } else {
    target.innerHTML = '';
    render(<App />, target);
  }
}

const OPS_STORAGE_KEY = 'eyesonly_ops_session';

interface OpsSession { token: string; actor: { id?: number; callsign: string; team: string; scenario_id: number } }

function getOpsSession(): OpsSession | null {
  try { const s = localStorage.getItem(OPS_STORAGE_KEY); if (s) { const d = JSON.parse(s); if (d.token) return d; } } catch {}
  return null;
}

async function opsFetch(path: string, session: OpsSession, opts: RequestInit = {}): Promise<Response> {
  return fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, ...(opts.headers || {}) },
  });
}

function renderOpsWithDOM(container: HTMLElement) {
  const session = getOpsSession();
  if (session) {
    renderOpsDashboard(container, session);
  } else {
    renderOpsJoin(container);
  }
}

const USER_SESSION_KEY_DOM = 'eyesonly_user_session';

function getDomUserSession(): { token: string; user: any } | null {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY_DOM);
    if (raw) { const d = JSON.parse(raw); if (d?.token) return d; }
  } catch {}
  return null;
}

function renderOpsJoin(container: HTMLElement) {
  const existingUser = getDomUserSession();
  const screen = document.createElement('div');
  screen.className = 'join-screen';
  screen.innerHTML = `
    <div class="logo">EYES ONLY</div>
    <div class="subtitle">FIELD OPERATIVE CHECK-IN</div>
    ${existingUser
      ? `<div class="field" style="text-align:center;"><label style="color:#33ff33;letter-spacing:2px;">LOGGED IN AS</label><div style="font-size:16px;color:#33ff33;letter-spacing:2px;padding:8px 0;">${existingUser.user?.callsign || existingUser.user?.username || 'OPERATIVE'}</div></div>`
      : `<div class="field"><label>USERNAME</label><input type="text" id="ops-username" placeholder="Enter username or register new" autocomplete="username" /></div>`
    }
    <div class="field"><label>JOIN CODE</label><input type="text" id="ops-code" placeholder="Enter join code" autocomplete="off" /></div>
    <div id="ops-error" class="error-msg" style="display:none"></div>
    <button id="ops-btn" class="btn">JOIN OPERATION</button>
  `;
  screen.querySelector('#ops-btn')!.addEventListener('click', async () => {
    const code = (document.getElementById('ops-code') as HTMLInputElement).value;
    const usernameEl = document.getElementById('ops-username') as HTMLInputElement | null;
    const username = usernameEl ? usernameEl.value.trim().toLowerCase() : '';
    const errEl = document.getElementById('ops-error')!;
    const btn = document.getElementById('ops-btn') as HTMLButtonElement;

    if (!code) { errEl.textContent = 'Enter a join code'; errEl.style.display = ''; return; }
    if (!existingUser && !username) { errEl.textContent = 'Enter your username'; errEl.style.display = ''; return; }

    btn.textContent = 'JOINING...'; btn.disabled = true; errEl.style.display = 'none';
    try {
      // Get or create user session token
      let userToken = existingUser?.token || null;
      if (!userToken && username) {
        // Try login, then register if not found
        let loginRes = await fetch('/api/user/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        if (!loginRes.ok) {
          const loginErr = await loginRes.json().catch(() => ({} as any));
          if (loginErr.error === 'AUTH_FAILED') {
            loginRes = await fetch('/api/user/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username }),
            });
          }
        }
        if (!loginRes.ok) {
          const d = await loginRes.json().catch(() => ({} as any));
          throw new Error(d.message || 'Login failed');
        }
        const loginData = await loginRes.json() as any;
        userToken = loginData.session_token;
        try { localStorage.setItem(USER_SESSION_KEY_DOM, JSON.stringify({ token: userToken, user: loginData.user })); } catch {}
      }

      if (!userToken) throw new Error('Account login required');

      // Join with user session token
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as any; throw new Error(d.message || 'Join failed'); }
      const data = await res.json() as any;
      const session: OpsSession = { token: data.token, actor: data.actor };
      localStorage.setItem(OPS_STORAGE_KEY, JSON.stringify(session));
      container.innerHTML = '';
      renderOpsDashboard(container, session);
    } catch (err: any) {
      errEl.textContent = err.message || 'Network error'; errEl.style.display = '';
      btn.textContent = 'JOIN OPERATION'; btn.disabled = false;
    }
  });
  container.appendChild(screen);
}

let opsPingQueue: any[] = [];

function renderOpsDashboard(container: HTMLElement, session: OpsSession) {
  container.innerHTML = `
    <header class="header">
      <h1>EYES ONLY // OPS</h1>
      <span class="status" id="ops-status-badge">${session.actor.callsign} [${session.actor.team.toUpperCase()}]</span>
    </header>
    <div class="screen" id="ops-screen">
      <div class="ops-context-bar" id="ops-context-bar">
        <div class="ctx-row">
          <div class="ctx-item"><span class="ctx-label">STATUS</span><span class="ctx-val" id="ops-ctx-status">—</span></div>
          <div class="ctx-item"><span class="ctx-label">CELL</span><span class="ctx-val" id="ops-ctx-cell">—</span></div>
          <div class="ctx-item"><span class="ctx-label">LANE</span><span class="ctx-val" id="ops-ctx-lane">—</span></div>
        </div>
        <div class="ctx-row">
          <div class="ctx-item"><span class="ctx-label">TENSION</span><span class="ctx-val" id="ops-ctx-tension">—</span></div>
          <div class="ctx-item"><span class="ctx-label">PINGS</span><span class="ctx-val" id="ops-ctx-pings">0</span></div>
          <div class="ctx-item"><span class="ctx-label">SCENARIO</span><span class="ctx-val" id="ops-ctx-scenario">—</span></div>
        </div>
        <div class="ctx-tension-bar" id="ops-ctx-tension-bar"><div class="ctx-tension-fill" id="ops-ctx-tension-fill"></div></div>
        <div id="ops-ctx-last-ping" class="ctx-last-ping" style="display:none;"></div>
      </div>
      <div class="stat-row">
        <div class="card"><h2>STATUS</h2><div class="value" style="color:var(--accent);" id="ops-actor-status">ACTIVE</div></div>
        <div class="card"><h2>TEAM</h2><div class="value">${session.actor.team.toUpperCase()}</div></div>
      </div>
      <div class="card" id="ops-pings-card">
        <h2>M DIRECTIVES</h2>
        <div id="ops-pings" style="max-height:200px;overflow-y:auto;"><div style="color:var(--text-dim);font-size:12px;">No directives.</div></div>
      </div>
      <div class="card"><h2>RECENT EVENTS</h2><div id="ops-events" style="max-height:200px;overflow-y:auto;">Loading...</div></div>
      <div class="card">
        <h2>CHECK-IN</h2>
        <div class="field"><label>LANE</label><input type="text" id="ops-checkin-lane" placeholder="Lane ID" /></div>
        <div class="field"><label>MESSAGE</label><input type="text" id="ops-checkin-msg" placeholder="Status update" /></div>
        <button class="btn" id="ops-checkin-btn" style="margin-top:8px;">CHECK IN</button>
      </div>
      <button class="btn danger" id="ops-disconnect" style="margin-top:auto;">DISCONNECT</button>
    </div>
  `;

  // Load events, pings, and status context
  loadOpsEvents(session);
  loadOpsPings(session);
  loadOpsStatus(session);
  setInterval(() => loadOpsEvents(session), 10000);
  setInterval(() => loadOpsPings(session), 8000);
  setInterval(() => loadOpsStatus(session), 12000);

  // Check-in handler
  document.getElementById('ops-checkin-btn')!.addEventListener('click', async () => {
    const lane = (document.getElementById('ops-checkin-lane') as HTMLInputElement).value;
    const msg = (document.getElementById('ops-checkin-msg') as HTMLInputElement).value;
    if (!lane) return;
    await opsFetch('/ops/checkin', session, { method: 'POST', body: JSON.stringify({ lane_id: lane, message: msg }) });
    (document.getElementById('ops-checkin-msg') as HTMLInputElement).value = '';
    loadOpsEvents(session);
  });

  // Disconnect
  document.getElementById('ops-disconnect')!.addEventListener('click', () => {
    localStorage.removeItem(OPS_STORAGE_KEY);
    container.innerHTML = '';
    renderOpsJoin(container);
  });

  // Connect WebSocket for real-time pings
  connectOpsWS(session, container);
}

// --- Ops Pings ---
async function loadOpsPings(session: OpsSession) {
  try {
    const res = await opsFetch('/ops/pings', session);
    if (!res.ok) return;
    const data = await res.json() as any;
    const pings = data.pings || [];
    const el = document.getElementById('ops-pings');
    if (!el) return;
    if (pings.length === 0) {
      el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;">No directives.</div>';
      return;
    }
    el.innerHTML = pings.slice(0, 10).map((p: any) => {
      const cmd = p.payload?.ping_command || '???';
      const cell = p.payload?.cell_id || '';
      const msg = p.payload?.message || '';
      const from = p.payload?.sent_by || 'M';
      const acked = p.acked;
      const ts = new Date(p.created_at).toLocaleTimeString();
      return `<div class="ping-item ${acked ? 'acked' : ''}" data-ping-id="${p.id}">
        <div class="ping-cmd" style="color:${acked ? 'var(--accent)' : 'var(--red)'}">${cmd}${cell ? ' → ' + cell : ''}</div>
        <div class="ping-meta">${ts} · from ${from}${msg ? ' · ' + msg : ''}</div>
        ${!acked ? `<button class="btn" style="padding:6px 12px;font-size:10px;margin-top:4px;max-width:120px;" data-ack-ping="${p.id}">ACK</button>` : '<span style="font-size:9px;color:var(--accent);">✓ ACKNOWLEDGED</span>'}
      </div>`;
    }).join('');

    // Wire ACK buttons
    el.querySelectorAll('[data-ack-ping]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pingId = parseInt((btn as HTMLElement).dataset.ackPing!, 10);
        await opsFetch('/ops/ack', session, { method: 'POST', body: JSON.stringify({ ping_event_id: pingId }) });
        // Dismiss flash if showing for this ping
        const flash = document.getElementById('ping-flash');
        if (flash) flash.remove();
        loadOpsPings(session);
      });
    });
  } catch {}
}

// --- Ping Flash Overlay ---
function showPingFlash(ping: any, session: OpsSession) {
  // Remove any existing flash
  document.getElementById('ping-flash')?.remove();

  const cmd = ping.ping_command || ping.payload?.ping_command || '???';
  const cell = ping.cell_id || ping.payload?.cell_id || '';
  const msg = ping.message || ping.payload?.message || '';
  const from = ping.sent_by || ping.payload?.sent_by || 'M';
  const eventId = ping.event_id || ping.id;

  const flash = document.createElement('div');
  flash.id = 'ping-flash';
  flash.className = 'ping-flash';

  let countdown = 30;
  flash.innerHTML = `
    <div class="ping-label">M DIRECTIVE</div>
    <div class="ping-command">${cmd}${cell ? ' → ' + cell : ''}</div>
    <div class="ping-detail">${msg || `Directive from ${from}`}</div>
    <div class="ping-timer" id="ping-countdown">${countdown}</div>
    <button class="ping-ack-btn" id="ping-ack-flash">ACKNOWLEDGE</button>
  `;
  document.body.appendChild(flash);

  // Countdown timer
  const timer = setInterval(() => {
    countdown--;
    const el = document.getElementById('ping-countdown');
    if (el) el.textContent = String(countdown);
    if (countdown <= 0) {
      clearInterval(timer);
      flash.remove();
    }
  }, 1000);

  // ACK button
  document.getElementById('ping-ack-flash')!.addEventListener('click', async () => {
    clearInterval(timer);
    await opsFetch('/ops/ack', session, { method: 'POST', body: JSON.stringify({ ping_event_id: eventId }) });
    flash.remove();
    loadOpsPings(session);
  });
}

// --- MOK Broadcast Notification ---
function showOpsBroadcast(message: string) {
  // Remove any existing broadcast
  document.getElementById('ops-broadcast')?.remove();

  const banner = document.createElement('div');
  banner.id = 'ops-broadcast';
  banner.className = 'ops-broadcast';
  banner.innerHTML = `
    <div class="broadcast-label">M BROADCAST</div>
    <div class="broadcast-msg">${message}</div>
  `;
  document.body.appendChild(banner);

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 500);
  }, 8000);

  // Tap to dismiss
  banner.addEventListener('click', () => {
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 300);
  });
}

// --- Frozen overlay for ops ---
function showOpsFrozen(frozen: boolean) {
  const existing = document.getElementById('ops-frozen-overlay');
  if (frozen && !existing) {
    const overlay = document.createElement('div');
    overlay.id = 'ops-frozen-overlay';
    overlay.className = 'ops-frozen-overlay';
    overlay.innerHTML = '<div class="frozen-msg">GAME FROZEN<br><span style="font-size:12px;letter-spacing:2px;">STAND BY FOR COMMAND</span></div>';
    document.body.appendChild(overlay);
  } else if (!frozen && existing) {
    existing.remove();
  }
}

// --- Ops WebSocket ---
let opsWsRetryCount = 0;
const OPS_WS_MAX_RETRIES = 5;
const OPS_WS_BASE_DELAY = 2000;

function connectOpsWS(session: OpsSession, container: HTMLElement) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    const ws = new WebSocket(`${proto}//${location.host}/api/ops/ws?token=${encodeURIComponent(session.token)}`);
    ws.onopen = () => {
      opsWsRetryCount = 0; // reset on successful connection
      const badge = document.getElementById('ops-status-badge');
      if (badge) badge.style.borderColor = 'var(--accent)';
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'mping') {
          // Check if this ping is for us
          const targetId = data.data?.target_actor_id;
          if (!targetId || String(targetId) === String((session.actor as any).id)) {
            showPingFlash(data.data, session);
          }
          loadOpsPings(session);
        } else if (data.type === 'state' && data.data?.frozen !== undefined) {
          showOpsFrozen(data.data.frozen);
        } else if (data.type === 'event') {
          const evType = data.data?.event_type || '';
          const payload = typeof data.data?.payload === 'string' ? JSON.parse(data.data.payload) : (data.data?.payload || {});

          // MOK broadcast — show notification banner
          if (evType === 'mok_broadcast') {
            showOpsBroadcast(payload.message || 'Directive from M');
          }
          // Surveillance / contact events — subtle notification
          else if (evType === 'surveillance_sweep' || evType === 'contact_injection') {
            showOpsBroadcast(payload.message || evType.replace(/_/g, ' ').toUpperCase());
          }

          loadOpsEvents(session);
          loadOpsStatus(session);
        } else if (data.type === 'escalation') {
          loadOpsEvents(session);
          loadOpsStatus(session);
        }
      } catch {}
    };
    ws.onclose = () => {
      const badge = document.getElementById('ops-status-badge');
      if (badge) badge.style.borderColor = 'var(--red)';
      if (opsWsRetryCount < OPS_WS_MAX_RETRIES) {
        const delay = OPS_WS_BASE_DELAY * Math.pow(2, opsWsRetryCount);
        opsWsRetryCount++;
        console.log(`[OPS WS] Reconnecting in ${delay}ms (attempt ${opsWsRetryCount}/${OPS_WS_MAX_RETRIES})`);
        setTimeout(() => connectOpsWS(session, container), delay);
      } else {
        console.warn('[OPS WS] Max retries reached. Refresh to reconnect.');
      }
    };
    ws.onerror = () => ws.close();
  } catch {}
}

// --- Ops Status Context ---
async function loadOpsStatus(session: OpsSession) {
  try {
    const res = await opsFetch('/ops/status', session);
    if (!res.ok) return;
    const data = await res.json() as any;

    // Update context bar values
    const statusEl = document.getElementById('ops-ctx-status');
    if (statusEl) {
      statusEl.textContent = (data.actor?.status || 'UNKNOWN').toUpperCase();
      statusEl.style.color = data.actor?.status === 'active' ? 'var(--accent)' : data.actor?.status === 'dark' ? '#555' : 'var(--amber)';
    }

    const cellEl = document.getElementById('ops-ctx-cell');
    if (cellEl) cellEl.textContent = data.actor?.cell_id || '—';

    const laneEl = document.getElementById('ops-ctx-lane');
    if (laneEl) laneEl.textContent = data.actor?.lane_id || '—';

    const tensionEl = document.getElementById('ops-ctx-tension');
    const tensionFill = document.getElementById('ops-ctx-tension-fill');
    if (data.cell) {
      const t = data.cell.tension || 0;
      if (tensionEl) {
        tensionEl.textContent = `${t}%`;
        tensionEl.style.color = t < 40 ? 'var(--accent)' : t < 70 ? 'var(--amber)' : 'var(--red)';
      }
      if (tensionFill) {
        tensionFill.style.width = `${t}%`;
        tensionFill.style.background = t < 40 ? 'var(--accent)' : t < 70 ? 'var(--amber)' : 'var(--red)';
      }
    } else {
      if (tensionEl) tensionEl.textContent = '—';
      if (tensionFill) tensionFill.style.width = '0%';
    }

    const pingsEl = document.getElementById('ops-ctx-pings');
    if (pingsEl) {
      const count = data.pending_pings || 0;
      pingsEl.textContent = String(count);
      pingsEl.style.color = count > 0 ? 'var(--red)' : 'var(--accent)';
    }

    const scenarioEl = document.getElementById('ops-ctx-scenario');
    if (scenarioEl) scenarioEl.textContent = data.scenario?.name || '—';

    // Update main status card
    const actorStatusEl = document.getElementById('ops-actor-status');
    if (actorStatusEl) actorStatusEl.textContent = (data.actor?.status || 'ACTIVE').toUpperCase();

    // Last ping context
    const lastPingEl = document.getElementById('ops-ctx-last-ping');
    if (lastPingEl && data.last_ping) {
      lastPingEl.style.display = '';
      lastPingEl.innerHTML = `<span class="ctx-label">LAST DIRECTIVE</span> <span style="color:${data.last_ping.acked ? 'var(--accent)' : 'var(--red)'};font-weight:bold;">${data.last_ping.command}${data.last_ping.cell_id ? ' → ' + data.last_ping.cell_id : ''}</span><span style="font-size:9px;color:#555;margin-left:6px;">${data.last_ping.acked ? '✓ ACK' : 'PENDING'}</span>`;
    } else if (lastPingEl) {
      lastPingEl.style.display = 'none';
    }

    // Frozen state check
    if (data.scenario?.frozen) {
      showOpsFrozen(true);
    }
  } catch {}
}

async function loadOpsEvents(session: OpsSession) {
  try {
    const res = await opsFetch('/ops/events', session);
    if (!res.ok) return;
    const data = await res.json() as any;
    const events = data.events || [];
    const el = document.getElementById('ops-events');
    if (!el) return;
    if (events.length === 0) { el.innerHTML = '<div style="color:var(--text-dim);">No events yet.</div>'; return; }
    el.innerHTML = events.slice(-20).reverse().map((ev: any) => {
      const ts = new Date(ev.created_at).toLocaleTimeString();
      return `<div style="padding:3px 0;border-bottom:1px solid var(--border);font-size:12px;"><span style="color:var(--text-dim);font-size:10px;">${ts}</span> <strong>${ev.event_type}</strong></div>`;
    }).join('');
  } catch {}
}
