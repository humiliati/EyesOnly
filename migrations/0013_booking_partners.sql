-- ============================================================
--   EYES ONLY — D1 Schema Migration v13
--   Booking, partner applications, and email outbox tables.
--   All timestamps are Unix epoch milliseconds.
-- ============================================================

-- ── Bookings ─────────────────────────────────────────────────
-- Stores mission booking requests.  Payment fields are populated
-- by the Stripe webhook once checkout completes (Phase 4).
CREATE TABLE IF NOT EXISTS bookings (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_type           TEXT NOT NULL CHECK (scenario_type IN ('scenario-1', 'scenario-2')),
  group_name              TEXT,
  lead_name               TEXT NOT NULL,
  lead_email              TEXT NOT NULL,
  lead_phone              TEXT,
  player_count            INTEGER NOT NULL DEFAULT 1,
  preferred_date          TEXT,           -- ISO 8601 date string
  preferred_time          TEXT,           -- HH:MM or "morning"/"afternoon"/"evening"
  -- Liability waiver
  waiver_accepted         INTEGER NOT NULL DEFAULT 0,  -- 1 = accepted
  waiver_version          TEXT,           -- e.g. "v1.0"
  waiver_signed_at        INTEGER,        -- epoch ms
  waiver_ip               TEXT,
  waiver_user_agent       TEXT,
  -- Emergency contact
  emergency_name          TEXT,
  emergency_phone         TEXT,
  emergency_relation      TEXT,
  -- Stripe payment (populated by webhook, Phase 4)
  stripe_payment_intent_id TEXT,
  stripe_session_id       TEXT,
  amount_cents            INTEGER,
  currency                TEXT DEFAULT 'usd',
  payment_status          TEXT NOT NULL DEFAULT 'pending'
                            CHECK (payment_status IN ('pending', 'paid', 'expired', 'refunded', 'failed')),
  -- Admin
  notes                   TEXT,
  status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'submitted', 'confirmed', 'canceled')),
  created_at              INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at              INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_bookings_email      ON bookings(lead_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment    ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_scenario   ON bookings(scenario_type);

-- ── Partner Applications ─────────────────────────────────────
-- Three form types: business_signon, legal_disclaimer, contact.
CREATE TABLE IF NOT EXISTS partner_applications (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  form_type         TEXT NOT NULL CHECK (form_type IN ('business_signon', 'legal_disclaimer', 'contact')),
  business_name     TEXT,
  business_type     TEXT,           -- restaurant, hotel, retail, entertainment, outdoor, other
  contact_name      TEXT NOT NULL,
  contact_email     TEXT NOT NULL,
  contact_phone     TEXT,
  subject           TEXT,           -- for contact form: general, media, sponsorship, actor, other
  message           TEXT,
  -- Legal form fields
  legal_agreed      INTEGER NOT NULL DEFAULT 0,  -- 1 = agreed
  legal_version     TEXT,
  legal_signed_at   INTEGER,        -- epoch ms
  legal_ip          TEXT,
  legal_user_agent  TEXT,
  -- Metadata
  metadata          TEXT DEFAULT '{}',  -- JSON blob for extensibility
  status            TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'reviewed', 'approved', 'rejected')),
  created_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_partner_apps_email  ON partner_applications(contact_email);
CREATE INDEX IF NOT EXISTS idx_partner_apps_type   ON partner_applications(form_type);
CREATE INDEX IF NOT EXISTS idx_partner_apps_status ON partner_applications(status);

-- ── Email Outbox ─────────────────────────────────────────────
-- Queued emails flushed by the cron trigger or on-demand.
CREATE TABLE IF NOT EXISTS email_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  to_address      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  -- Processing state
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'sent', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  error_message   TEXT,
  -- Traceability
  ref_type        TEXT,           -- 'booking' or 'partner_application'
  ref_id          INTEGER,        -- FK to bookings.id or partner_applications.id
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(status);
