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
  /**
   * VAPID public key (base64url) for Web Push.
   * Generate with: openssl ecparam -name prime256v1 -genkey -noout -out vapid.pem
   * Then derive public key in base64url.
   * Set via `wrangler secret put VAPID_PUBLIC_KEY`
   */
  VAPID_PUBLIC_KEY?: string;
  /**
   * VAPID private key (base64url) for Web Push.
   * Set via `wrangler secret put VAPID_PRIVATE_KEY`
   */
  VAPID_PRIVATE_KEY?: string;
  /**
   * VAPID subject — mailto: or https: URI for push service contact.
   * Set in wrangler.jsonc vars.
   */
  VAPID_SUBJECT?: string;
  /**
   * Stripe secret key (sk_test_... or sk_live_...).
   * Set via `wrangler secret put STRIPE_SECRET_KEY`
   */
  STRIPE_SECRET_KEY: string;
  /**
   * Stripe publishable key (pk_test_... or pk_live_...).
   * Safe to expose to frontend — set in wrangler.jsonc vars.
   */
  STRIPE_PUBLISHABLE_KEY: string;
  /**
   * Stripe webhook signing secret (whsec_...).
   * Set via `wrangler secret put STRIPE_WEBHOOK_SECRET`
   */
  STRIPE_WEBHOOK_SECRET?: string;
}

// --- Database Row Types ---

export interface ScenarioRow {
  id: number;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  config: string; // JSON blob — M's working draft
  published_config: string | null; // JSON blob — frozen snapshot for Ops
  published_at: number | null; // timestamp of last publish
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
  // Account-link: when set, this actor represents a persistent user account.
  user_id?: number | null;
  // Actor classification. 'player' should always be account-linked.
  actor_kind?: 'player' | 'staff' | 'npc' | 'business' | string;
  callsign: string;
  team: 'red' | 'blue' | 'director';
  lane_id: string | null;
  cell_id: string | null;
  status: string;
  password_hash: string;
  // Telemetry fields (added by migration 0004)
  last_lat: number | null;
  last_lng: number | null;
  last_seen_at: number | null;
  last_accel_x: number | null;
  last_accel_y: number | null;
  last_accel_z: number | null;
  motion_state: 'unknown' | 'stationary' | 'walking' | 'running' | 'vehicle' | 'dropped' | null;
  // Ops privacy flag: when 0, other ops viewers should not see this actor's lat/lng.
  ops_telemetry_visible?: 0 | 1 | number;
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
  items_json?: string | null; // JSON array of item ids
  cell_id: string | null;
  created_at: number;
  updated_at: number;
}

// --- Phase 3: Scenario Beats, Player Locations, Fog, Microchat ---

export interface ScenarioBeatRow {
  id: number;
  scenario_id: number;
  beat_seq: number;
  title: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  trigger_radius_m: number;
  event_type: string;
  auto_advance: number;  // 1 = fires on proximity, 0 = manual only
  unlocked_at: number | null;
  created_at: number;
}

export interface PlayerLocationRow {
  player_id: string;
  scenario_id: number;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  reported_at: number;
}

export interface FogLitZoneRow {
  scenario_id: string;
  zone_label: string;
  lit: number;  // 1 = lit (visible to players), 0 = dark
  updated_at: number;
}

export interface MicrochatMessageRow {
  id: number;
  scenario_id: number;
  from_id: string;  // actor_id as string, or 'M'
  to_id: string;    // actor_id as string, or 'M'
  ciphertext: string; // "<iv_b64url>:<ct_b64url>" AES-GCM
  delivered: number;
  created_at: number;
}

// --- Phase 2: Geofence + Push ---

export interface GeofenceZoneRow {
  id: number;
  scenario_id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  trigger_on: 'enter' | 'exit' | 'both';
  trigger_event_type: string;
  active: number; // 1 = enabled, 0 = disabled
  created_at: number;
}

export interface ActorGeofenceStateRow {
  actor_id: number;
  zone_id: number;
  inside: number; // 1 = inside, 0 = outside
  updated_at: number;
}

export interface PushSubscriptionRow {
  id: number;
  actor_id: number;
  scenario_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: number;
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

export interface ScenarioRequirements {
  min_red?: number;
  min_blue?: number;
  min_staff?: number;
  drops_must_have_items?: boolean;
  require_published?: boolean;
  custom_checks?: Array<{ label: string; key: string; met?: boolean }>;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  required: number | boolean;
  actual: number | boolean;
  pass: boolean;
  detail?: string;
}

export interface ScenarioConfig {
  grid?: GridConfig;
  frozen?: boolean;
  requirements?: ScenarioRequirements;
  [key: string]: unknown;
}

export interface AuthTokenRow {
  id: number;
  token_hash: string;
  actor_id: number;
  // Optional account link for identity and grants
  user_id?: number | null;
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
  // Legacy: callsign used for anonymous join. Prefer account-linked join (Authorization: Bearer <user session token>).
  callsign?: string;
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

export interface TelemetryRequest {
  lat?: number;
  lng?: number;
  /** Accelerometer X axis (m/s²) */
  accel_x?: number;
  /** Accelerometer Y axis (m/s²) */
  accel_y?: number;
  /** Accelerometer Z axis (m/s²) */
  accel_z?: number;
  /** Client-classified motion state */
  motion_state?: 'unknown' | 'stationary' | 'walking' | 'running' | 'vehicle' | 'dropped';
  /** Battery level 0–100 */
  battery?: number;
  /** Whether device is in low-power mode */
  low_power?: boolean;
}

export interface PanicRequest {
  lat?: number;
  lng?: number;
  message?: string;
}

export interface GeofenceRequest {
  name: string;
  lat: number;
  lng: number;
  radius_m?: number;
  trigger_on?: 'enter' | 'exit' | 'both';
  trigger_event_type?: string;
}

export interface PushSubscribeRequest {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface MicrochatSendRequest {
  /** actor_id as string, or 'M' */
  to_id: string;
  /** AES-GCM encrypted message: "<iv_b64url>:<ciphertext_b64url>" */
  ciphertext: string;
}

export interface PlayerLocationRequest {
  lat: number;
  lng: number;
  accuracy_m?: number;
  /** Identifier for the player; defaults to auth callsign if omitted */
  player_id?: string;
}

export interface ScenarioBeatRequest {
  scenario_id: number;
  title: string;
  description?: string;
  lat?: number;
  lng?: number;
  trigger_radius_m?: number;
  event_type?: string;
  beat_seq?: number;
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
  | 'event'            // new event broadcast
  | 'state'            // full state snapshot
  | 'actor_update'     // actor position/status change
  | 'actor_telemetry'  // actor GPS + motion update
  | 'geofence_trigger' // actor entered/exited a geofence zone
  | 'deadman_alert'    // actor missed heartbeat deadline
  | 'escalation'       // escalation tier change
  | 'actor_message'    // Phase 3: microchat (actor ↔ M, encrypted)
  | 'actor_message_ack'// Phase 3: microchat delivery confirmation
  | 'beat_unlock'      // Phase 3: scenario beat auto-triggered
  | 'player_location'  // Phase 3: player GPS update (M-only)
  | 'fog_update'       // Phase 3: fog of war zone toggled
  | 'decoy_ping'       // Phase 3: false ping — actors only, NOT in event log
  | 'map_published'    // M canonized map — Ops should refresh
  | 'scenario_dispatched' // M deployed scenario — Ops can join
  | 'ops_alarm'          // Ops raised alarm — M sees badge, auto-freeze at 3+
  | 'ops_alarm_ack'      // M acknowledged/cleared alarms
  | 'ping'
  | 'pong';

export interface WSMessage {
  type: WSMessageType;
  data: unknown;
  timestamp: number;
  /**
   * Routing audience for ScenarioRoom broadcast.
   * Default: 'all' — sent to every connected WebSocket.
   * 'actors'    — sent only to red/blue team connections.
   * 'directors' — sent only to director connections.
   * 'target'    — sent only to target_actor_id + all directors.
   */
  audience?: 'all' | 'actors' | 'directors' | 'target';
  /** Used when audience === 'target': the actor_id to route to (plus all directors). */
  target_actor_id?: number;
}

// --- Auth Context (attached by middleware) ---

export interface AuthContext {
  actor_id: number;
  callsign: string;
  role: 'red' | 'blue' | 'director';
  scenario_id: number;
  // When present, this actor is bound to a persistent user account.
  user_id?: number | null;
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

// --- Booking & Partners Types ---

export interface BookingRow {
  id: number;
  scenario_type: 'scenario-1' | 'scenario-2';
  group_name: string | null;
  lead_name: string;
  lead_email: string;
  lead_phone: string | null;
  player_count: number;
  preferred_date: string | null;
  preferred_time: string | null;
  waiver_accepted: number;
  waiver_version: string | null;
  waiver_signed_at: number | null;
  waiver_ip: string | null;
  waiver_user_agent: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_relation: string | null;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string | null;
  amount_cents: number | null;
  currency: string;
  payment_status: 'pending' | 'paid' | 'expired' | 'refunded' | 'failed';
  notes: string | null;
  status: 'draft' | 'submitted' | 'confirmed' | 'canceled';
  created_at: number;
  updated_at: number;
}

export interface PartnerApplicationRow {
  id: number;
  form_type: 'business_signon' | 'legal_disclaimer' | 'contact';
  business_name: string | null;
  business_type: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  subject: string | null;
  message: string | null;
  legal_agreed: number;
  legal_version: string | null;
  legal_signed_at: number | null;
  legal_ip: string | null;
  legal_user_agent: string | null;
  metadata: string;
  status: 'new' | 'reviewed' | 'approved' | 'rejected';
  created_at: number;
}

export interface EmailOutboxRow {
  id: number;
  to_address: string;
  subject: string;
  body_html: string;
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  last_attempt_at: number | null;
  error_message: string | null;
  ref_type: string | null;
  ref_id: number | null;
  created_at: number;
}

// --- Booking API Types ---

export interface BookingCreateRequest {
  scenario_type: 'scenario-1' | 'scenario-2';
  group_name?: string;
  lead_name: string;
  lead_email: string;
  lead_phone?: string;
  player_count: number;
  preferred_date?: string;
  preferred_time?: string;
  emergency_name?: string;
  emergency_phone?: string;
  emergency_relation?: string;
  notes?: string;
}

export interface BookingWaiverRequest {
  waiver_version: string;
  signature_name: string;  // typed signature
}

export interface PartnerApplyRequest {
  form_type: 'business_signon' | 'legal_disclaimer' | 'contact';
  business_name?: string;
  business_type?: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  subject?: string;
  message?: string;
  legal_agreed?: boolean;
}
