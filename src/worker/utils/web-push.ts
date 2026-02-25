/* ============================================================
   EYES ONLY — Web Push Utility
   Sends Web Push notifications using VAPID (RFC 8292).
   Runs entirely on the Cloudflare Worker runtime via SubtleCrypto.
   No external npm dependencies.

   Usage:
     const ok = await sendWebPush(env, subscription, {
       title: 'M DIRECTIVE',
       body: 'ENGAGE — proceed to sector B3',
       data: { ping_event_id: 42 },
     });

   Setup:
     1. Generate VAPID key pair once:
        npx web-push generate-vapid-keys --json
     2. Set secrets:
        wrangler secret put VAPID_PUBLIC_KEY   # base64url-encoded public key
        wrangler secret put VAPID_PRIVATE_KEY  # base64url-encoded private key
     3. Set var in wrangler.jsonc:
        "VAPID_SUBJECT" = "mailto:ops@flapsandseals.com"
   ============================================================ */

import type { Env, PushSubscriptionRow } from '../../shared/types';

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;       // Notification tag for dedup
  data?: Record<string, unknown>;
  vibrate?: number[];
  silent?: boolean;
}

/**
 * Send a Web Push notification to a single subscription.
 * Returns true on 200/201/204, false if subscription is gone (410/404).
 * Throws on transient errors.
 */
export async function sendWebPush(
  env: Env,
  sub: Pick<PushSubscriptionRow, 'endpoint' | 'p256dh' | 'auth'>,
  payload: PushPayload,
): Promise<boolean> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) {
    // VAPID keys not configured — skip silently
    console.warn('[web-push] VAPID keys not set; skipping push.');
    return false;
  }

  const subject = env.VAPID_SUBJECT || 'mailto:ops@flapsandseals.com';
  const ttl = 60 * 5; // 5-minute TTL for ops notifications

  // Build JWT for VAPID Authorization header
  const vapidJwt = await buildVapidJwt(env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY, sub.endpoint, subject);

  // Encrypt the payload using the subscription's ECDH keys
  const body = JSON.stringify(payload);
  const encrypted = await encryptPayload(body, sub.p256dh, sub.auth);

  const resp = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization':  `vapid t=${vapidJwt},k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Type':   'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL':            String(ttl),
      'Urgency':        'high',
    },
    body: encrypted,
  });

  if (resp.status === 410 || resp.status === 404) return false; // Subscription expired
  if (!resp.ok) throw new Error(`Push failed: ${resp.status}`);
  return true;
}

/**
 * Send Web Push to all subscriptions for a given actor/scenario.
 * Silently removes expired subscriptions from caller-provided list.
 */
export async function sendWebPushToAll(
  env: Env,
  subs: PushSubscriptionRow[],
  payload: PushPayload,
  onExpired?: (sub: PushSubscriptionRow) => Promise<void>,
): Promise<void> {
  await Promise.all(subs.map(async (sub) => {
    try {
      const ok = await sendWebPush(env, sub, payload);
      if (!ok && onExpired) await onExpired(sub);
    } catch (err) {
      console.error('[web-push] push error:', err);
    }
  }));
}

// ===== JWT / VAPID Signing =====

async function buildVapidJwt(
  privateKeyB64: string,
  _publicKeyB64: string,
  endpoint: string,
  subject: string,
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  }));

  const signingInput = `${header}.${claims}`;

  const privateKey = await importPrivateKey(privateKeyB64);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${b64urlBuffer(sig)}`;
}

async function importPrivateKey(b64urlKey: string): Promise<CryptoKey> {
  const raw = base64urlDecode(b64urlKey);
  return crypto.subtle.importKey(
    'pkcs8',
    raw.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

// ===== Payload Encryption (RFC 8291 / aes128gcm) =====

async function encryptPayload(
  plaintext: string,
  p256dhB64: string,
  authB64: string,
): Promise<ArrayBuffer> {
  const receiverPublicKey = await importPublicKey(p256dhB64);
  const authSecret = base64urlDecode(authB64);

  // Generate ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );

  // Derive shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPublicKey },
    ephemeralKeyPair.privateKey,
    256,
  );

  // Export ephemeral public key
  const ephemeralPubKeyRaw = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);
  const receiverPubKeyRaw  = await crypto.subtle.exportKey('raw', receiverPublicKey);

  // HKDF to derive content encryption key + nonce (RFC 8291 §3.3)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk = await hkdf(
    new Uint8Array(sharedBits),
    authSecret,
    buildInfo('auth', new Uint8Array(0), new Uint8Array(0)),
    32,
  );

  const cek = await hkdf(
    prk,
    salt,
    buildInfo('aesgcm', new Uint8Array(receiverPubKeyRaw), new Uint8Array(ephemeralPubKeyRaw)),
    16,
  );

  const nonce = await hkdf(
    prk,
    salt,
    buildInfo('nonce', new Uint8Array(receiverPubKeyRaw), new Uint8Array(ephemeralPubKeyRaw)),
    12,
  );

  const key = await crypto.subtle.importKey('raw', cek.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt']);
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer },
    key,
    encoded,
  );

  // Build aes128gcm record: salt(16) + rs(4) + keyid_len(1) + keyid + ciphertext
  const rs = 4096;
  const keyid = new Uint8Array(ephemeralPubKeyRaw);
  const result = new Uint8Array(16 + 4 + 1 + keyid.length + ciphertext.byteLength);
  let offset = 0;
  result.set(salt,            offset); offset += 16;
  result.set(uint32be(rs),    offset); offset += 4;
  result[offset++] = keyid.length;
  result.set(keyid,           offset); offset += keyid.length;
  result.set(new Uint8Array(ciphertext), offset);
  return result.buffer;
}

async function importPublicKey(b64urlKey: string): Promise<CryptoKey> {
  const raw = base64urlDecode(b64urlKey);
  return crypto.subtle.importKey(
    'raw',
    raw.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm.buffer as ArrayBuffer, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, info: info.buffer as ArrayBuffer },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

function buildInfo(type: string, receiverKey: Uint8Array, senderKey: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const result = new Uint8Array(typeBytes.length + 2 + receiverKey.length + 2 + senderKey.length);
  let offset = 0;
  result.set(typeBytes, offset); offset += typeBytes.length;
  result.set(uint16be(receiverKey.length), offset); offset += 2;
  result.set(receiverKey, offset); offset += receiverKey.length;
  result.set(uint16be(senderKey.length), offset); offset += 2;
  result.set(senderKey, offset);
  return result;
}

// ===== Utility Functions =====

function b64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlBuffer(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function uint32be(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, false);
  return buf;
}

function uint16be(n: number): Uint8Array {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, n, false);
  return buf;
}
