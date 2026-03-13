/* ============================================================
   EYES ONLY — Email Outbox Utility
   Queues emails to the D1 email_outbox table for deferred
   delivery via the cron-triggered flush handler.
   ============================================================ */

/**
 * Options for queuing an outbound email.
 */
export interface QueueEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Traceability: 'booking' | 'partner_application' */
  refType?: string;
  /** Traceability: FK to the source row */
  refId?: number;
}

/**
 * Insert a row into `email_outbox` with status 'queued'.
 * The cron trigger flushes queued rows via an external email
 * provider (Phase 4+).  For now, rows accumulate for inspection.
 */
export async function queueEmail(
  db: D1Database,
  opts: QueueEmailOptions,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO email_outbox
         (to_address, subject, body_html, status, ref_type, ref_id, created_at)
       VALUES (?, ?, ?, 'queued', ?, ?, ?)
       RETURNING id`,
    )
    .bind(
      opts.to,
      opts.subject,
      opts.html,
      opts.refType ?? null,
      opts.refId ?? null,
      Date.now(),
    )
    .first<{ id: number }>();

  if (!result) {
    throw new Error('Failed to queue email');
  }

  return result.id;
}
