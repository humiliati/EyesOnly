/* ============================================================
   EYES ONLY — Ops UI State Store
   Minimal reactive store for field operative UI.
   ============================================================ */

const API_BASE = '/api';

export interface Actor {
  id: number;
  callsign: string;
  team: string;
  scenario_id: number;
  lane_id?: string;
  status?: string;
}

export interface OpsEvent {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface ScenarioInfo {
  id: number;
  name: string;
  status: string;
  config: Record<string, unknown>;
}

export interface Lane {
  lane_id: string;
  label: string;
  config: Record<string, unknown>;
}

export interface AppState {
  screen: 'join' | 'dashboard' | 'events' | 'map';
  token: string | null;
  actor: Actor | null;
  scenario: ScenarioInfo | null;
  lanes: Lane[];
  events: OpsEvent[];
  error: string | null;
  loading: boolean;
  wsConnected: boolean;
}

type Listener = () => void;

const STORAGE_KEY = 'eyesonly_ops_session';
const listeners: Set<Listener> = new Set();

let state: AppState = {
  screen: 'join',
  token: null,
  actor: null,
  scenario: null,
  lanes: [],
  events: [],
  error: null,
  loading: false,
  wsConnected: false,
};

let ws: WebSocket | null = null;

// --- Store API ---

export function getState(): AppState {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(partial: Partial<AppState>): void {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn());
}

// --- Init: restore session ---

export function init(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.token && data.actor) {
        state = { ...state, token: data.token, actor: data.actor, screen: 'dashboard' };
        fetchScenario();
        connectWS();
      }
    }
  } catch { /* ignore */ }
}

function saveSession(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: state.token, actor: state.actor }));
  } catch { /* ignore */ }
}

// --- Auth ---

export async function join(code: string, callsign: string): Promise<boolean> {
  setState({ loading: true, error: null });
  try {
    const res = await fetch(`${API_BASE}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, callsign }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Join failed' }));
      setState({ loading: false, error: (err as { message?: string }).message || 'Join failed' });
      return false;
    }
    const data = await res.json() as { token: string; actor: Actor };
    setState({
      loading: false,
      token: data.token,
      actor: data.actor,
      screen: 'dashboard',
    });
    saveSession();
    fetchScenario();
    connectWS();
    return true;
  } catch (e) {
    setState({ loading: false, error: 'Network error — is the server online?' });
    return false;
  }
}

export function disconnect(): void {
  if (ws) { ws.close(); ws = null; }
  setState({
    screen: 'join',
    token: null,
    actor: null,
    scenario: null,
    lanes: [],
    events: [],
    wsConnected: false,
  });
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// --- API calls ---

async function authFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
      ...(opts.headers || {}),
    },
  });
}

export async function fetchScenario(): Promise<void> {
  try {
    const res = await authFetch('/ops/scenario');
    if (!res.ok) return;
    const data = await res.json() as { scenario: ScenarioInfo; lanes: Lane[]; actor: Actor | null };
    setState({
      scenario: data.scenario,
      lanes: data.lanes,
      actor: data.actor ? { ...state.actor!, ...data.actor } : state.actor,
    });
  } catch { /* offline */ }
}

export async function checkin(message?: string): Promise<boolean> {
  setState({ loading: true });
  try {
    // Try GPS
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }),
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* no GPS */ }

    const res = await authFetch('/ops/checkin', {
      method: 'POST',
      body: JSON.stringify({ message, lat, lng }),
    });
    setState({ loading: false });
    return res.ok;
  } catch {
    setState({ loading: false });
    return false;
  }
}

export async function fetchEvents(): Promise<void> {
  try {
    const res = await authFetch('/ops/events?limit=50');
    if (!res.ok) return;
    const data = await res.json() as { events: OpsEvent[] };
    setState({ events: data.events });
  } catch { /* offline */ }
}

export async function reportDeadDrop(laneId: string, action: 'place' | 'retrieve', label?: string): Promise<boolean> {
  setState({ loading: true });
  try {
    const res = await authFetch('/ops/dead-drop', {
      method: 'POST',
      body: JSON.stringify({ lane_id: laneId, action, label }),
    });
    setState({ loading: false });
    return res.ok;
  } catch {
    setState({ loading: false });
    return false;
  }
}

// --- WebSocket ---

function connectWS(): void {
  if (!state.token || ws) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/api/ops/ws`;

  try {
    ws = new WebSocket(url);

    ws.onopen = () => {
      // Auth is handled by the Worker via query params routed from the DO
      setState({ wsConnected: true });
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'event') {
          setState({ events: [...state.events, msg.data as OpsEvent].slice(-100) });
        } else if (msg.type === 'escalation') {
          // Re-fetch full scenario on escalation
          fetchScenario();
          setState({ events: [...state.events, { id: 0, event_type: 'escalation', payload: msg.data as Record<string, unknown>, created_at: Date.now() }].slice(-100) });
        }
      } catch { /* bad message */ }
    };

    ws.onclose = () => {
      setState({ wsConnected: false });
      ws = null;
      // Reconnect after 3s
      setTimeout(() => { if (state.token) connectWS(); }, 3000);
    };

    ws.onerror = () => { ws?.close(); };
  } catch { /* WebSocket unavailable */ }
}

// --- Navigation ---

export function navigate(screen: AppState['screen']): void {
  setState({ screen, error: null });
  if (screen === 'events') fetchEvents();
  if (screen === 'dashboard') fetchScenario();
}
