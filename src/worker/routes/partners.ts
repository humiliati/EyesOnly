/* ============================================================
   EYES ONLY — Partner Application API Routes
   Handles local partner form submissions (business sign-on,
   legal disclaimer, contact us).

   POST /api/partners/apply        — submit a partner application
   GET  /api/partners/status/:id   — retrieve application status
   ============================================================ */

import { Hono } from 'hono';
import type { Env, PartnerApplicationRow, PartnerApplyRequest } from '../../shared/types';
import { queueEmail } from '../utils/email';

type HonoEnv = { Bindings: Env; Variables: Record<string, unknown> };

export const partnersRoutes = new Hono<HonoEnv>();

// --- Validation ---

const FORM_TYPES = ['business_signon', 'legal_disclaimer', 'contact'] as const;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Human-readable labels
const FORM_LABELS: Record<string, string> = {
  business_signon: 'Business Partnership Application',
  legal_disclaimer: 'Legal Disclaimer Agreement',
  contact: 'Contact Inquiry',
};

// --- POST /apply — Submit a partner application ---

partnersRoutes.post('/apply', async (c) => {
  let body: PartnerApplyRequest;
  try {
    body = await c.req.json<PartnerApplyRequest>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Validate required fields
  if (!body.form_type || !FORM_TYPES.includes(body.form_type as any)) {
    return c.json({ error: 'Invalid form_type. Must be business_signon, legal_disclaimer, or contact.' }, 400);
  }
  if (!body.contact_name || !body.contact_name.trim()) {
    return c.json({ error: 'contact_name is required.' }, 400);
  }
  if (!body.contact_email || !isValidEmail(body.contact_email)) {
    return c.json({ error: 'A valid contact_email is required.' }, 400);
  }

  // Type-specific validation
  if (body.form_type === 'business_signon' && !body.business_name) {
    return c.json({ error: 'business_name is required for business sign-on.' }, 400);
  }
  if (body.form_type === 'legal_disclaimer' && !body.legal_agreed) {
    return c.json({ error: 'You must agree to the legal terms.' }, 400);
  }
  if (body.form_type === 'contact' && !body.message) {
    return c.json({ error: 'message is required for contact inquiries.' }, 400);
  }

  const db = c.env.DB;
  const now = Date.now();
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const ua = c.req.header('user-agent') || 'unknown';

  try {
    const result = await db
      .prepare(`
        INSERT INTO partner_applications
          (form_type, business_name, business_type, contact_name, contact_email, contact_phone,
           subject, message, legal_agreed, legal_version, legal_signed_at, legal_ip, legal_user_agent,
           metadata, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
        RETURNING *
      `)
      .bind(
        body.form_type,
        body.business_name || null,
        body.business_type || null,
        body.contact_name.trim(),
        body.contact_email.trim().toLowerCase(),
        body.contact_phone || null,
        body.subject || null,
        body.message || null,
        body.legal_agreed ? 1 : 0,
        body.form_type === 'legal_disclaimer' ? 'v1.0-draft' : null,
        body.legal_agreed ? now : null,
        body.form_type === 'legal_disclaimer' ? ip : null,
        body.form_type === 'legal_disclaimer' ? ua : null,
        '{}',
        now,
      )
      .first<PartnerApplicationRow>();

    if (!result) {
      return c.json({ error: 'Failed to create application.' }, 500);
    }

    const formLabel = FORM_LABELS[body.form_type] || body.form_type;

    // Queue confirmation email to the applicant
    await queueEmail(db, {
      to: result.contact_email,
      subject: `EYES ONLY — ${formLabel} Received`,
      html: `
        <h2>${formLabel} Received</h2>
        <p>Hello ${result.contact_name},</p>
        <p>Thank you for your interest in the EYES ONLY partner program.
           We have received your ${formLabel.toLowerCase()} and will respond within 48 hours.</p>
        <p><strong>Reference ID:</strong> ${result.id}</p>
        <p>&mdash; EYES ONLY Operations</p>
      `,
      refType: 'partner_application',
      refId: result.id,
    });

    // Queue notification to ops
    await queueEmail(db, {
      to: 'ops@flapsandseals.com',
      subject: `New Partner App #${result.id}: ${formLabel}`,
      html: `
        <h2>New ${formLabel}</h2>
        <p><strong>ID:</strong> ${result.id}<br>
           <strong>Type:</strong> ${body.form_type}<br>
           <strong>Name:</strong> ${result.contact_name} (${result.contact_email})<br>
           ${result.business_name ? `<strong>Business:</strong> ${result.business_name}<br>` : ''}
           ${result.message ? `<strong>Message:</strong> ${result.message}<br>` : ''}
        </p>
      `,
      refType: 'partner_application',
      refId: result.id,
    });

    return c.json({
      ok: true,
      application: {
        id: result.id,
        form_type: result.form_type,
        status: result.status,
        created_at: result.created_at,
      },
    }, 201);
  } catch (err: any) {
    return c.json({ error: 'Database error: ' + (err.message || 'unknown') }, 500);
  }
});

// --- GET /status/:id — Retrieve application status ---

partnersRoutes.get('/status/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid application ID.' }, 400);

  const db = c.env.DB;
  const app = await db
    .prepare('SELECT id, form_type, contact_name, status, created_at FROM partner_applications WHERE id = ?')
    .bind(id)
    .first();

  if (!app) return c.json({ error: 'Application not found.' }, 404);

  return c.json({ ok: true, application: app });
});
