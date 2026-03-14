/* ============================================================
   EYES ONLY — Booking API Routes
   Handles mission booking creation, status retrieval,
   liability waiver recording, and Stripe Hosted Checkout.

   POST /api/booking/create        — create a new booking
   GET  /api/booking/:id           — retrieve booking status
   POST /api/booking/:id/waiver    — record digital waiver signature
   POST /api/booking/:id/checkout  — create Stripe Checkout session
   GET  /api/booking/verify-payment — verify session on return
   POST /api/booking/webhook       — Stripe webhook handler
   ============================================================ */

import { Hono } from 'hono';
import type { Env, BookingRow, BookingCreateRequest, BookingWaiverRequest } from '../../shared/types';
import { queueEmail } from '../utils/email';
import {
  createCheckoutSession,
  retrieveCheckoutSession,
  verifyWebhookSignature,
  SCENARIO_PRICES,
} from '../utils/stripe';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

export const bookingRoutes = new Hono<HonoEnv>();

// --- Validation helpers ---

const SCENARIO_TYPES = ['scenario-1', 'scenario-2'] as const;
const PLAYER_LIMITS: Record<string, { min: number; max: number }> = {
  'scenario-1': { min: 2, max: 60 },
  'scenario-2': { min: 3, max: 30 },
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- POST /create — Create a new booking ---

bookingRoutes.post('/create', async (c) => {
  let body: BookingCreateRequest;
  try {
    body = await c.req.json<BookingCreateRequest>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Validate required fields
  if (!body.scenario_type || !SCENARIO_TYPES.includes(body.scenario_type as any)) {
    return c.json({ error: 'Invalid scenario_type. Must be "scenario-1" or "scenario-2".' }, 400);
  }
  if (!body.lead_name || !body.lead_name.trim()) {
    return c.json({ error: 'lead_name is required.' }, 400);
  }
  if (!body.lead_email || !isValidEmail(body.lead_email)) {
    return c.json({ error: 'A valid lead_email is required.' }, 400);
  }

  const limits = PLAYER_LIMITS[body.scenario_type];
  const playerCount = body.player_count || limits.min;
  if (playerCount < limits.min || playerCount > limits.max) {
    return c.json({
      error: `player_count must be between ${limits.min} and ${limits.max} for ${body.scenario_type}.`,
    }, 400);
  }

  const now = Date.now();
  const db = c.env.DB;

  try {
    const result = await db
      .prepare(`
        INSERT INTO bookings
          (scenario_type, group_name, lead_name, lead_email, lead_phone,
           player_count, preferred_date, preferred_time,
           emergency_name, emergency_phone, emergency_relation,
           notes, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
        RETURNING *
      `)
      .bind(
        body.scenario_type,
        body.group_name || null,
        body.lead_name.trim(),
        body.lead_email.trim().toLowerCase(),
        body.lead_phone || null,
        playerCount,
        body.preferred_date || null,
        body.preferred_time || null,
        body.emergency_name || null,
        body.emergency_phone || null,
        body.emergency_relation || null,
        body.notes || null,
        now,
        now,
      )
      .first<BookingRow>();

    if (!result) {
      return c.json({ error: 'Failed to create booking.' }, 500);
    }

    // Queue confirmation email to the customer
    const scenarioLabel = body.scenario_type === 'scenario-1'
      ? 'Scenario 1 — 24-Hour Field Exercise'
      : 'Scenario 2 — 72-Hour Extended Operation';

    await queueEmail(db, {
      to: result.lead_email,
      subject: `EYES ONLY — Booking Received: ${scenarioLabel}`,
      html: `
        <h2>Mission Booking Received</h2>
        <p>Hello ${result.lead_name},</p>
        <p>We have received your booking request for <strong>${scenarioLabel}</strong>.</p>
        <p><strong>Booking ID:</strong> ${result.id}<br>
           <strong>Team Size:</strong> ${result.player_count} players<br>
           ${result.preferred_date ? `<strong>Preferred Date:</strong> ${result.preferred_date}<br>` : ''}
           ${result.group_name ? `<strong>Group:</strong> ${result.group_name}<br>` : ''}
        </p>
        <p>Next steps: complete the liability waiver and proceed to payment.</p>
        <p>&mdash; EYES ONLY Operations</p>
      `,
      refType: 'booking',
      refId: result.id,
    });

    // Queue notification to ops
    await queueEmail(db, {
      to: 'ops@flapsandseals.com',
      subject: `New Booking #${result.id}: ${scenarioLabel}`,
      html: `
        <h2>New Booking Submission</h2>
        <p><strong>ID:</strong> ${result.id}<br>
           <strong>Scenario:</strong> ${result.scenario_type}<br>
           <strong>Lead:</strong> ${result.lead_name} (${result.lead_email})<br>
           <strong>Players:</strong> ${result.player_count}<br>
           ${result.preferred_date ? `<strong>Date:</strong> ${result.preferred_date}<br>` : ''}
           ${result.group_name ? `<strong>Group:</strong> ${result.group_name}<br>` : ''}
        </p>
      `,
      refType: 'booking',
      refId: result.id,
    });

    return c.json({
      ok: true,
      booking: {
        id: result.id,
        scenario_type: result.scenario_type,
        status: result.status,
        payment_status: result.payment_status,
        created_at: result.created_at,
      },
    }, 201);
  } catch (err: any) {
    return c.json({ error: 'Database error: ' + (err.message || 'unknown') }, 500);
  }
});

// --- GET /:id — Retrieve booking status ---

bookingRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid booking ID.' }, 400);

  const db = c.env.DB;
  const booking = await db
    .prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first<BookingRow>();

  if (!booking) return c.json({ error: 'Booking not found.' }, 404);

  return c.json({
    ok: true,
    booking: {
      id: booking.id,
      scenario_type: booking.scenario_type,
      group_name: booking.group_name,
      lead_name: booking.lead_name,
      player_count: booking.player_count,
      preferred_date: booking.preferred_date,
      preferred_time: booking.preferred_time,
      waiver_accepted: !!booking.waiver_accepted,
      payment_status: booking.payment_status,
      status: booking.status,
      created_at: booking.created_at,
    },
  });
});

// --- POST /:id/waiver — Record digital waiver signature ---

bookingRoutes.post('/:id/waiver', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid booking ID.' }, 400);

  let body: BookingWaiverRequest;
  try {
    body = await c.req.json<BookingWaiverRequest>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.waiver_version || !body.signature_name) {
    return c.json({ error: 'waiver_version and signature_name are required.' }, 400);
  }

  const db = c.env.DB;
  const now = Date.now();

  // Get client IP and user agent for enforceability records
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const ua = c.req.header('user-agent') || 'unknown';

  const result = await db
    .prepare(`
      UPDATE bookings
      SET waiver_accepted = 1,
          waiver_version = ?,
          waiver_signed_at = ?,
          waiver_ip = ?,
          waiver_user_agent = ?,
          updated_at = ?
      WHERE id = ? AND waiver_accepted = 0
      RETURNING id
    `)
    .bind(body.waiver_version, now, ip, ua, now, id)
    .first();

  if (!result) {
    return c.json({ error: 'Booking not found or waiver already signed.' }, 404);
  }

  return c.json({ ok: true, waiver_signed_at: now });
});

// --- POST /:id/checkout — Create Stripe Checkout session ---

bookingRoutes.post('/:id/checkout', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid booking ID.' }, 400);

  const db = c.env.DB;
  const booking = await db
    .prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first<BookingRow>();

  if (!booking) return c.json({ error: 'Booking not found.' }, 404);

  // Must have signed waiver before checkout
  if (!booking.waiver_accepted) {
    return c.json({ error: 'Waiver must be signed before proceeding to payment.' }, 400);
  }

  // Don't allow double-pay
  if (booking.payment_status === 'paid') {
    return c.json({ error: 'This booking has already been paid.' }, 400);
  }

  const pricing = SCENARIO_PRICES[booking.scenario_type];
  if (!pricing) {
    return c.json({ error: 'Unknown scenario type.' }, 500);
  }

  // Derive origin from request (works in both dev and prod)
  const url = new URL(c.req.url);
  const origin = `${url.protocol}//${url.host}`;

  try {
    const secretKeyRaw = (c.env.STRIPE_SECRET_KEY || '');
    const secretKey = secretKeyRaw.trim();
    if (!secretKey) {
      console.error('[checkout] STRIPE_SECRET_KEY missing/blank', { len: secretKeyRaw.length });
      return c.json({ error: 'Stripe is not configured (missing STRIPE_SECRET_KEY).' }, 500);
    }
    if (!secretKey.startsWith('sk_')) {
      console.error('[checkout] STRIPE_SECRET_KEY has unexpected prefix', { prefix: secretKey.slice(0, 3), len: secretKey.length });
      return c.json({ error: 'Stripe is misconfigured (STRIPE_SECRET_KEY must be an sk_ secret key).' }, 500);
    }

    const session = await createCheckoutSession({
      secretKey,
      bookingId: booking.id,
      scenarioType: booking.scenario_type,
      customerEmail: booking.lead_email,
      playerCount: booking.player_count,
      groupName: booking.group_name || undefined,
      origin,
    });

    // Store session ID and amount on the booking
    await db
      .prepare(`
        UPDATE bookings
        SET stripe_session_id = ?,
            amount_cents = ?,
            currency = 'usd',
            updated_at = ?
        WHERE id = ?
      `)
      .bind(session.id, pricing.amount_cents, Date.now(), booking.id)
      .run();

    return c.json({
      ok: true,
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (err: any) {
    console.error('[checkout] Stripe error:', err);
    return c.json({ error: 'Failed to create checkout session: ' + (err.message || 'unknown') }, 500);
  }
});

// --- GET /verify-payment — Verify payment on return from Stripe ---

bookingRoutes.get('/verify-payment', async (c) => {
  const sessionId = c.req.query('session_id');
  if (!sessionId) return c.json({ error: 'session_id query parameter is required.' }, 400);

  try {
    const secretKey = (c.env.STRIPE_SECRET_KEY || '').trim();
    if (!secretKey) return c.json({ error: 'Stripe is not configured (missing STRIPE_SECRET_KEY).' }, 500);

    const session = await retrieveCheckoutSession(secretKey, sessionId);
    const bookingId = session.metadata?.booking_id;

    if (!bookingId) {
      return c.json({ error: 'Session has no booking_id metadata.' }, 400);
    }

    const db = c.env.DB;

    // If paid, update the booking
    if (session.payment_status === 'paid') {
      await db
        .prepare(`
          UPDATE bookings
          SET payment_status = 'paid',
              stripe_payment_intent_id = ?,
              status = 'confirmed',
              updated_at = ?
          WHERE id = ? AND payment_status != 'paid'
        `)
        .bind(
          session.payment_intent || null,
          Date.now(),
          parseInt(bookingId, 10),
        )
        .run();

      // Queue payment confirmation email
      const booking = await db
        .prepare('SELECT * FROM bookings WHERE id = ?')
        .bind(parseInt(bookingId, 10))
        .first<BookingRow>();

      if (booking && booking.payment_status === 'paid') {
        const pricing = SCENARIO_PRICES[booking.scenario_type];
        await queueEmail(db, {
          to: booking.lead_email,
          subject: `EYES ONLY — Payment Confirmed: Booking #${booking.id}`,
          html: `
            <h2>Payment Confirmed</h2>
            <p>Hello ${booking.lead_name},</p>
            <p>Your payment of <strong>$${((pricing?.amount_cents || 0) / 100).toFixed(2)}</strong>
               for <strong>${pricing?.label || booking.scenario_type}</strong> has been received.</p>
            <p><strong>Booking ID:</strong> ${booking.id}<br>
               <strong>Status:</strong> Confirmed<br>
               <strong>Team Size:</strong> ${booking.player_count} players</p>
            <p>We will be in touch with your mission briefing. Stand by.</p>
            <p>&mdash; EYES ONLY Operations</p>
          `,
          refType: 'booking',
          refId: booking.id,
        });
      }
    }

    return c.json({
      ok: true,
      booking_id: parseInt(bookingId, 10),
      payment_status: session.payment_status === 'paid' ? 'paid' : 'pending',
    });
  } catch (err: any) {
    return c.json({ error: 'Failed to verify payment: ' + (err.message || 'unknown') }, 500);
  }
});

// --- POST /webhook — Stripe webhook handler ---

bookingRoutes.post('/webhook', async (c) => {
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Webhook secret not configured — skip verification (dev only)
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
  }

  const rawBody = await c.req.text();
  const sigHeader = c.req.header('stripe-signature') || '';

  // Verify signature if secret is set
  if (webhookSecret) {
    const event = await verifyWebhookSignature(rawBody, sigHeader, webhookSecret);
    if (!event) {
      return c.json({ error: 'Invalid signature' }, 400);
    }
    return handleWebhookEvent(c.env.DB, event);
  }

  // Dev mode: parse without verification
  try {
    const event = JSON.parse(rawBody) as Record<string, unknown>;
    return handleWebhookEvent(c.env.DB, event);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
});

/**
 * Process a verified Stripe webhook event.
 */
async function handleWebhookEvent(
  db: D1Database,
  event: Record<string, unknown>,
) {
  const type = event.type as string;

  if (type === 'checkout.session.completed') {
    const session = (event.data as any)?.object;
    if (!session) return new Response('OK', { status: 200 });

    const bookingId = session.metadata?.booking_id;
    if (!bookingId) return new Response('OK', { status: 200 });

    const paymentStatus = session.payment_status;
    const paymentIntent = session.payment_intent;

    if (paymentStatus === 'paid') {
      await db
        .prepare(`
          UPDATE bookings
          SET payment_status = 'paid',
              stripe_payment_intent_id = ?,
              status = 'confirmed',
              updated_at = ?
          WHERE id = ? AND payment_status != 'paid'
        `)
        .bind(paymentIntent || null, Date.now(), parseInt(bookingId, 10))
        .run();

      // Queue payment confirmation email
      const booking = await db
        .prepare('SELECT * FROM bookings WHERE id = ?')
        .bind(parseInt(bookingId, 10))
        .first<BookingRow>();

      if (booking) {
        const pricing = SCENARIO_PRICES[booking.scenario_type];
        await queueEmail(db, {
          to: booking.lead_email,
          subject: `EYES ONLY — Payment Confirmed: Booking #${booking.id}`,
          html: `
            <h2>Payment Confirmed</h2>
            <p>Hello ${booking.lead_name},</p>
            <p>Your payment of <strong>$${((pricing?.amount_cents || 0) / 100).toFixed(2)}</strong>
               has been received. Your mission booking is now <strong>confirmed</strong>.</p>
            <p><strong>Booking ID:</strong> ${booking.id}</p>
            <p>We will be in touch with your mission briefing. Stand by.</p>
            <p>&mdash; EYES ONLY Operations</p>
          `,
          refType: 'booking',
          refId: booking.id,
        });

        // Notify ops
        await queueEmail(db, {
          to: 'ops@flapsandseals.com',
          subject: `Payment Received — Booking #${booking.id}`,
          html: `
            <h2>Payment Confirmed</h2>
            <p><strong>Booking:</strong> #${booking.id}<br>
               <strong>Scenario:</strong> ${booking.scenario_type}<br>
               <strong>Lead:</strong> ${booking.lead_name} (${booking.lead_email})<br>
               <strong>Amount:</strong> $${((pricing?.amount_cents || 0) / 100).toFixed(2)}<br>
               <strong>Players:</strong> ${booking.player_count}</p>
          `,
          refType: 'booking',
          refId: booking.id,
        });
      }
    }
  }

  if (type === 'checkout.session.expired') {
    const session = (event.data as any)?.object;
    const bookingId = session?.metadata?.booking_id;
    if (bookingId) {
      await db
        .prepare(`
          UPDATE bookings
          SET payment_status = 'expired', updated_at = ?
          WHERE id = ? AND payment_status = 'pending'
        `)
        .bind(Date.now(), parseInt(bookingId, 10))
        .run();
    }
  }

  return new Response('OK', { status: 200 });
}
