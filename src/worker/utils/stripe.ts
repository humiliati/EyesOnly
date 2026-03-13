/* ============================================================
   EYES ONLY — Stripe Hosted Checkout Utility
   Uses Stripe REST API directly (no npm SDK needed in Workers).
   SAQ A compliant — card data never touches our servers.
   ============================================================ */

const STRIPE_API = 'https://api.stripe.com/v1';

/** Scenario pricing in cents (USD). */
export const SCENARIO_PRICES: Record<string, { amount_cents: number; label: string }> = {
  'scenario-1': { amount_cents: 50000, label: 'Scenario 1 — 24-Hour Field Exercise' },
  'scenario-2': { amount_cents: 120000, label: 'Scenario 2 — 72-Hour Extended Operation' },
};

/** Helper: form-encode a flat object for Stripe API. */
function formEncode(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

/** Helper: form-encode nested objects for Stripe API (e.g., metadata[key]). */
function formEncodeDeep(params: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(formEncodeDeep(value as Record<string, unknown>, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.filter(Boolean).join('&');
}

/** Generic Stripe API request. */
async function stripeRequest<T = unknown>(
  secretKey: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${STRIPE_API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? formEncodeDeep(body) : undefined,
  });

  const data = await response.json() as any;

  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe API error: ${response.status}`);
  }

  return data as T;
}

/* ---- Checkout Session Types ---- */

export interface StripeCheckoutSession {
  id: string;
  url: string;
  payment_intent: string | null;
  payment_status: string;
  status: string;
  customer_email: string | null;
  amount_total: number | null;
  metadata: Record<string, string>;
}

export interface CreateCheckoutOptions {
  secretKey: string;
  bookingId: number;
  scenarioType: string;
  customerEmail: string;
  playerCount: number;
  groupName?: string;
  /** Full origin URL, e.g., "https://flapsandseals.com" */
  origin: string;
}

/**
 * Create a Stripe Checkout Session (hosted payment page).
 * Returns the session object with `url` to redirect the customer to.
 */
export async function createCheckoutSession(
  opts: CreateCheckoutOptions,
): Promise<StripeCheckoutSession> {
  const pricing = SCENARIO_PRICES[opts.scenarioType];
  if (!pricing) throw new Error(`Unknown scenario_type: ${opts.scenarioType}`);

  const params: Record<string, unknown> = {
    mode: 'payment',
    'payment_method_types[0]': 'card',
    customer_email: opts.customerEmail,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': pricing.amount_cents,
    'line_items[0][price_data][product_data][name]': `EYES ONLY: ${pricing.label}`,
    'line_items[0][price_data][product_data][description]':
      `${opts.playerCount} players${opts.groupName ? ` — ${opts.groupName}` : ''}`,
    'line_items[0][quantity]': 1,
    success_url: `${opts.origin}/booking.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/booking.html?checkout=cancel&booking_id=${opts.bookingId}`,
    metadata: {
      booking_id: String(opts.bookingId),
      scenario_type: opts.scenarioType,
      player_count: String(opts.playerCount),
    },
  };

  return stripeRequest<StripeCheckoutSession>(
    opts.secretKey,
    'POST',
    '/checkout/sessions',
    params,
  );
}

/**
 * Retrieve a Checkout Session by ID (for verification on return).
 */
export async function retrieveCheckoutSession(
  secretKey: string,
  sessionId: string,
): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    secretKey,
    'GET',
    `/checkout/sessions/${sessionId}`,
  );
}

/* ---- Webhook Signature Verification ---- */

/**
 * Verify a Stripe webhook signature using the Web Crypto API.
 * Returns the parsed event object or null if verification fails.
 */
export async function verifyWebhookSignature(
  payload: string,
  sigHeader: string,
  webhookSecret: string,
  toleranceSeconds = 300,
): Promise<Record<string, unknown> | null> {
  // Parse the sig header: t=<timestamp>,v1=<signature>,v1=<signature>...
  const elements = sigHeader.split(',');
  let timestamp = '';
  const signatures: string[] = [];

  for (const el of elements) {
    const [key, value] = el.split('=', 2);
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return null;

  // Check timestamp tolerance
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return null;

  // Compute expected signature: HMAC-SHA256(timestamp + "." + payload, webhook_secret)
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time-ish comparison (good enough for Workers)
  const match = signatures.some((sig) => sig === expectedSig);
  if (!match) return null;

  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}
