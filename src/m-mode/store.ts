/* ============================================================
   EYES ONLY — M Mode Director Store
   Full scenario state, WebSocket sync, API calls.
   ============================================================ */

const API_BASE = '/api';

// --- Types ---

export interface Scenario {
  id: number; name: string; status: string;
  config: Record<string, unknown>;
}

export interface Lane {
  id: number; lane_id: string; label: string; sort_order: number;
  config: Record<string, unknown>;
  actors: Actor[];
  dead_drops: DeadDrop[];
}

export interface Actor {
  id: number; callsign: string; team: string;
  status: string; lane_id?: string;
}

export interface DeadDrop {
  id: number; label: string; status: string;
  lane_id?: string;
}

export interface MEvent {
  id: number; event_type: string;
  payload: Record<string, unknown>;
  actor_id?: number;
  created_at: number;
}

export interface MState {
  auth: 'login' | 'authenticated';
  token: string | null;
  callsign: string | null;
  scenarioId: number | null;
  scenarios: Scenario[];
  scenario: Scenario | null;
  lanes: Lane[];
  unassignedActors: Actor[];
  events: MEvent[];
  wsConnected: boolean;
  error: string | null;
  loading: boolean;
  selectedLane: string | null;
}

type Listener = () => void;

const STORAGE_KEY = 'eyesonly_mmode_session';
const listeners: Set<Listener> = new Set();

let state: MState = {
  auth: 'login',
  token: null,
  callsign: null,
  scenarioId: null,
  scenarios: [],
  scenario: null,
  lanes: [],
  unassignedActors: [],
  events: [],
  wsConnected: false,
  error: null,
  loading: false,
  selectedLane: null,
};

let ws: WebSocket | null = null;

// --- Core ---

export function getState(): MState { return state; }
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setState(partial: Partial<MState>): void {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn());
}

// --- Init ---

export function init(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const d = JSON.parse(saved);
      if (d.token) {
        state = { ...state, token: d.token, callsign: d.callsign, scenarioId: d.scenarioId, auth: 'authenticated' };
        if (d.scenarioId) loadGrid(d.scenarioId);
        fetchScenarios();
        connectWS();
      }
    }
  } catch { /* ignore */ }
}

function saveSession(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: state.token, callsign: state.callsign, scenarioId: state.scenarioId,
    }));
  } catch { /* ignore */ }
}

// --- Auth ---

export async function login(callsign: string, password: string, scenarioId: number): Promise<boolean> {
  setState({ loading: true, error: null });
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callsign, password, scenario_id: scenarioId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, string>;
      setState({ loading: false, error: err.message || 'Login failed' });
      return false;
    }
    const data = await res.json() as { token: string; actor: { id: number; callsign: string; team: string; scenario_id: number } };
    if (data.actor.team !== 'director') {
      setState({ loading: false, error: 'Director access required' });
      return false;
    }
    setState({
      loading: false, auth: 'authenticated',
      token: data.token, callsign: data.actor.callsign, scenarioId: data.actor.scenario_id,
    });
    saveSession();
    fetchScenarios();
    loadGrid(data.actor.scenario_id);
    connectWS();
    return true;
  } catch {
    setState({ loading: false, error: 'Network error' });
    return false;
  }
}

export function logout(): void {
  if (ws) { ws.close(); ws = null; }
  setState({
    auth: 'login', token: null, callsign: null, scenarioId: null,
    scenarios: [], scenario: null, lanes: [], unassignedActors: [],
    events: [], wsConnected: false, selectedLane: null,
  });
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// --- API helpers ---

async function mFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
      ...(opts.headers || {}),
    },
  });
}

// --- Scenarios ---

export async function fetchScenarios(): Promise<void> {
  try {
    const res = await mFetch('/m/scenarios');
    if (res.ok) {
      const data = await res.json() as { scenarios: Scenario[] };
      setState({ scenarios: data.scenarios });
    }
  } catch { /* offline */ }
}

export async function createScenario(name: string): Promise<void> {
  setState({ loading: true });
  try {
    const res = await mFetch('/m/scenario', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      await fetchScenarios();
      const data = await res.json() as { scenario: Scenario };
      setState({ loading: false, scenarioId: data.scenario.id });
      saveSession();
      loadGrid(data.scenario.id);
    } else {
      setState({ loading: false });
    }
  } catch { setState({ loading: false }); }
}

export async function activateScenario(id: number): Promise<void> {
  await mFetch('/m/scenario', {
    method: 'POST',
    body: JSON.stringify({ id, status: 'active' }),
  });
  await fetchScenarios();
  loadGrid(id);
}

export function selectScenario(id: number): void {
  setState({ scenarioId: id, selectedLane: null });
  saveSession();
  loadGrid(id);
  fetchEventLog(id);
}

// --- Grid ---

export async function loadGrid(scenarioId: number): Promise<void> {
  try {
    const res = await mFetch(`/m/grid/${scenarioId}`);
    if (res.ok) {
      const data = await res.json() as {
        scenario: Scenario;
        lanes: Lane[];
        unassigned_actors: Actor[];
      };
      setState({
        scenario: data.scenario,
        lanes: data.lanes,
        unassignedActors: data.unassigned_actors,
      });
    }
  } catch { /* offline */ }
}

// --- Lanes ---

export async function addLane(laneId: string, label: string): Promise<void> {
  if (!state.scenarioId) return;
  await mFetch('/m/lane', {
    method: 'POST',
    body: JSON.stringify({
      scenario_id: state.scenarioId,
      lane_id: laneId,
      label,
      sort_order: state.lanes.length,
    }),
  });
  loadGrid(state.scenarioId);
}

export function selectLane(laneId: string | null): void {
  setState({ selectedLane: laneId });
}

// --- Actors ---

export async function addActor(callsign: string, team: string, password?: string, laneId?: string): Promise<void> {
  if (!state.scenarioId) return;
  await mFetch('/m/actor', {
    method: 'POST',
    body: JSON.stringify({
      scenario_id: state.scenarioId,
      callsign,
      team,
      password,
      lane_id: laneId,
    }),
  });
  loadGrid(state.scenarioId);
}

export async function moveActor(actorId: number, laneId: string): Promise<void> {
  await mFetch('/m/actor', {
    method: 'POST',
    body: JSON.stringify({ id: actorId, lane_id: laneId }),
  });
  if (state.scenarioId) loadGrid(state.scenarioId);
}

// --- Events ---

export async function fetchEventLog(scenarioId?: number): Promise<void> {
  const sid = scenarioId || state.scenarioId;
  if (!sid) return;
  try {
    const res = await mFetch(`/m/events/${sid}?limit=200`);
    if (res.ok) {
      const data = await res.json() as { events: MEvent[] };
      setState({ events: data.events });
    }
  } catch { /* offline */ }
}

export async function injectEvent(eventType: string, payload: Record<string, unknown>, laneId?: string): Promise<void> {
  await mFetch('/m/event', {
    method: 'POST',
    body: JSON.stringify({ event_type: eventType, payload, lane_id: laneId }),
  });
  if (state.scenarioId) fetchEventLog();
}

// --- Escalation ---

export async function escalate(tier: number, message?: string): Promise<void> {
  if (!state.scenarioId) return;
  await mFetch('/m/escalation', {
    method: 'POST',
    body: JSON.stringify({ scenario_id: state.scenarioId, tier, message }),
  });
  fetchEventLog();
}

// --- Join Codes ---

export async function generateJoinCode(team: string): Promise<string | null> {
  if (!state.scenarioId) return null;
  try {
    const res = await mFetch('/m/join-code', {
      method: 'POST',
      body: JSON.stringify({ scenario_id: state.scenarioId, team }),
    });
    if (res.ok) {
      const data = await res.json() as { join_code: { code: string } };
      return data.join_code.code;
    }
  } catch { /* offline */ }
  return null;
}

// --- WebSocket ---

function connectWS(): void {
  if (!state.token || ws) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    ws = new WebSocket(`${proto}//${location.host}/api/m/ws`);
    ws.onopen = () => setState({ wsConnected: true });
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'event' || msg.type === 'escalation') {
          const newEvent: MEvent = {
            id: msg.data?.id || 0,
            event_type: msg.type === 'escalation' ? 'escalation' : (msg.data?.event_type || msg.type),
            payload: msg.data || {},
            created_at: msg.timestamp || Date.now(),
          };
          setState({ events: [...state.events, newEvent].slice(-500) });
          // Refresh grid on state-changing events
          if (state.scenarioId) loadGrid(state.scenarioId);
        } else if (msg.type === 'actor_update') {
          if (state.scenarioId) loadGrid(state.scenarioId);
        }
      } catch { /* bad msg */ }
    };
    ws.onclose = () => {
      setState({ wsConnected: false });
      ws = null;
      setTimeout(() => { if (state.token) connectWS(); }, 3000);
    };
    ws.onerror = () => ws?.close();
  } catch { /* WS unavailable */ }
}
