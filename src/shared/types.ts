/* ============================================================
   EYES ONLY — Shared Type Definitions
   Cloudflare bindings, database rows, API payloads.
   ============================================================ */

// --- Cloudflare Worker Bindings ---

export interface Env {
  DB: D1Database;
  SCENARIO_ROOM: DurableObjectNamespace;
  R2: R2Bucket;
  ASSETS: Fetcher;
}

// --- Database Row Types ---

export interface ScenarioRow {
  id: number;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  config: string; // JSON blob
  created_at: number;
  updated_at: number;
}

export interface LaneRow {
  id: number;
  scenario_id: number;
  lane_id: string;
  label: string;
  sort_order: number;
  config: string; // JSON blob (color, icon, etc.)
}

export interface ActorRow {
  id: number;
  scenario_id: number;
  callsign: string;
  team: 'red' | 'blue' | 'director';
  lane_id: string | null;
  cell_id: string | null;
  status: string;
  password_hash: string;
  created_at: number;
  updated_at: number;
}

export interface EventRow {
  id: number;
  scenario_id: number;
  actor_id: number | null;
  event_type: string;
  payload: string; // JSON blob
  created_at: number;
}

export interface DeadDropRow {
  id: number;
  scenario_id: number;
  lane_id: string;
  label: string;
  lat: number | null;
  lng: number | null;
  status: 'placed' | 'active' | 'retrieved' | 'compromised';
  placed_by: number | null;
  retrieved_by: number | null;
  asset_key: string | null; // R2 object key for photo
  cell_id: string | null;
  created_at: number;
  updated_at: number;
}

// --- UGRS Grid Types ---

export type CellStatus = 'working' | 'degraded' | 'compromised' | 'offline' | 'unknown';

export interface GridCellRow {
  id: number;
  scenario_id: number;
  cell_id: string;
  col: number;
  row: number;
  lane_id: string | null;
  status: CellStatus;
  tension: number;
  notes: string;
}

export interface GridConfig {
  cols: number;
  rows: number;
  origin_px: [number, number];
  block_w_px: number;
  block_h_px: number;
  col_labels: string[];
  row_labels: string[];
}

export interface ScenarioConfig {
  grid?: GridConfig;
  frozen?: boolean;
  [key: string]: unknown;
}

export interface AuthTokenRow {
  id: number;
  token_hash: string;
  actor_id: number;
  role: 'red' | 'blue' | 'director';
  scenario_id: number;
  expires_at: number;
  created_at: number;
}

export interface JoinCodeRow {
  id: number;
  code: string;
  scenario_id: number;
  team: 'red' | 'blue';
  max_uses: number;
  used_count: number;
  created_at: number;
}

// --- API Payload Types ---

export interface JoinRequest {
  code: string;
  callsign: string;
}

export interface JoinResponse {
  token: string;
  actor: {
    id: number;
    callsign: string;
    team: string;
    scenario_id: number;
  };
}

export interface LoginRequest {
  callsign: string;
  password: string;
  scenario_id: number;
}

export interface CheckinRequest {
  lat?: number;
  lng?: number;
  message?: string;
}

export interface DeadDropRequest {
  lane_id: string;
  label: string;
  lat?: number;
  lng?: number;
  action: 'place' | 'retrieve';
}

export interface EventPayload {
  event_type: string;
  payload: Record<string, unknown>;
  lane_id?: string;
  actor_id?: number;
}

export interface EscalationRequest {
  scenario_id: number;
  tier: number;
  message?: string;
}

// --- WebSocket Message Types ---

export type WSMessageType =
  | 'event'        // new event broadcast
  | 'state'        // full state snapshot
  | 'actor_update' // actor position/status change
  | 'escalation'   // escalation tier change
  | 'ping'
  | 'pong';

export interface WSMessage {
  type: WSMessageType;
  data: unknown;
  timestamp: number;
}

// --- Auth Context (attached by middleware) ---

export interface AuthContext {
  actor_id: number;
  callsign: string;
  role: 'red' | 'blue' | 'director';
  scenario_id: number;
}

// --- User Account Types ---

export interface UserAccountRow {
  id: number;
  username: string;
  email: string | null;
  email_verified: number;
  callsign: string;
  created_at: number;
  last_login: number;
  cryptos: number;
  preferences: string; // JSON blob
}

export interface WebAuthnCredentialRow {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  device_name: string | null;
  created_at: number;
  last_used_at: number;
}

export interface UserSessionRow {
  id: number;
  session_token: string;
  user_id: number;
  expires_at: number;
  created_at: number;
  last_activity: number;
}

export interface UserInventoryRow {
  id: number;
  user_id: number;
  item_id: string;
  item_type: 'persistent' | 'loose';
  quantity: number;
  metadata: string; // JSON blob
  acquired_at: number;
}

export interface UserHighscoreRow {
  id: number;
  user_id: number;
  game_id: string;
  mode: 'human' | 'agent';
  score: number;
  metadata: string; // JSON blob
  achieved_at: number;
}

export interface EmailTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  purpose: 'verify_email' | 'recover_account';
  expires_at: number;
  used_at: number | null;
  created_at: number;
}

// --- User Auth API Types ---

export interface UserRegisterRequest {
  username: string;
  callsign?: string; // Optional, defaults to username
  email?: string;    // Optional, for recovery
}

export interface UserRegisterResponse {
  user_id: number;
  username: string;
  challenge: string; // WebAuthn challenge (base64url)
}

export interface UserRegisterCompleteRequest {
  user_id: number;
  challenge: string;
  credential: PublicKeyCredential; // WebAuthn credential
  device_name?: string;
}

export interface UserLoginStartRequest {
  username: string;
}

export interface UserLoginStartResponse {
  user_id: number;
  challenge: string; // WebAuthn challenge (base64url)
  credentials: Array<{
    id: string;
    transports?: AuthenticatorTransport[];
  }>;
}

export interface UserLoginCompleteRequest {
  user_id: number;
  challenge: string;
  credential: PublicKeyCredential; // WebAuthn assertion
}

export interface UserLoginCompleteResponse {
  session_token: string;
  user: {
    id: number;
    username: string;
    callsign: string;
    cryptos: number;
  };
}

export interface UserSessionContext {
  user_id: number;
  username: string;
  callsign: string;
}

// --- WebAuthn Types ---

export interface WebAuthnChallenge {
  challenge: string;
  user_id: number;
  expires_at: number;
}
