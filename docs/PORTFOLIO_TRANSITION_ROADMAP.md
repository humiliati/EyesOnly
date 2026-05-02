# flapsandseals.com — Portfolio Transition Roadmap

> **Status:** Active — supersedes framing from `BOOKING_PARTNERS_ROADMAP.docx`
> **Direction:** flapsandseals.com transitions from ARG/travel-agency funnel to portfolio and community showcase
> **Last Updated:** 2026-05-01

---

## Audit of the Previous Roadmap

The `BOOKING_PARTNERS_ROADMAP.docx` was written for a different product moment — one where live tactical exercises were already running and the site needed to convert visitors into paying participants. That moment hasn't arrived yet. Five problems make the old roadmap wrong for where the project actually is:

**Problem 1 — Wrong anchor.** Every phase was organized around "book a live exercise." The exercise program isn't active. Building a booking funnel before there's anything to book is a distraction and misleads visitors about what the site offers.

**Problem 2 — Travel-agency liability waiver (Phase 3.2).** The old roadmap specified a full assumption-of-risk, medical self-certification, photo-release, emergency-contact, typed-signature waiver. That is infrastructure for an operating physical exercise business. It should not appear on a portfolio site and should not be drafted without legal counsel involved. Cut entirely until the exercise program launches.

**Problem 3 — Stripe checkout for exercises (Phase 4).** The Stripe account is real and should be preserved in the codebase, but the full checkout flow for booking a 90–240 minute urban CTF experience should not be built as priority work. The account can remain configured and dormant. The phase gets deferred, not deleted.

**Problem 4 — No About Us page.** The old roadmap had no concept of who Stellar Aqua is, what the community mission is, or why any of this was built. A portfolio without an About section is a demo reel with no name on it. This was a genuine omission.

**Problem 5 — Partners page framed as actor/volunteer recruitment.** Phase 3.3 built three partner forms designed to recruit actors and volunteers into an escape-room support role. The Chamber of Commerce partnership and community relationships are real and valuable — but they should be framed as community-building credentials, not a casting call for a show that isn't running yet.

---

## What This Roadmap Keeps

Everything built to date IS the portfolio. The platform demonstrates:

- A 162-module vanilla JS game engine running on Cloudflare Workers with D1, Durable Objects, and R2
- Six arcade games with a shared ArcadeEngine base class and BossAdapter interface
- A puzzle designer portal with live preview and publish lifecycle
- A games designer portal letting non-developers create and publish ArcadeEngine games
- 167 audio assets with a full R2 pipeline, manifest, and audio controls widget
- A modular ARG director console (M Console) and field ops interface
- A card-based roguelike with 35+ cards, synergy engine, and procedural dungeons
- A dossier-desk aesthetic proven across four pages (booking, partners, contact, home-v2 spec)
- A theme engine with four CRT themes working across all pages

The Stripe account, D1 schema, and bookings infrastructure stay in the codebase. They're dormant until the exercise program is ready. The Chamber of Commerce partnership and Stellar Aqua identity are real signals of community credibility that belong on the site.

---

## Revised Direction by Page

| Page | Old Frame | New Frame |
|------|-----------|-----------|
| `/` (home) | ARG terminal + exercise promotion | Portfolio terminal: the platform itself is the demo |
| `/about.html` | (did not exist) | Who Stellar Aqua is, community mission, what this platform was built to do |
| `/partners.html` | Actor/volunteer recruitment for escape-room exercises | Community partnerships: CoC relationship, local collaboration, what community building looks like here |
| `/booking.html` | Book a live exercise now, Stripe checkout | Coming soon / interest list — exercises are in development; the Stripe infrastructure is ready when they are |
| `/contact.html` | Generic contact | Primary action for anyone who wants to collaborate, commission work, or get notified when exercises launch |
| `/games.html` | Arcade + roguelike games | Portfolio artifact: this is what the engine can do |

---

## Navigation

The current nav (from `HOME-V2-SPEC.md`) is:

```
EYES ONLY   ♠ Booking   ♥ Partners   ♣ Contact   ♦ Arcade
```

Revised nav adds About Us and demotes Booking to a lower-urgency position:

```
EYES ONLY   ♠ About   ♥ Partners   ♣ Contact   ♦ Arcade   · Booking
```

- **About** replaces the first slot. It answers "who is this" for any first-time visitor.
- **Partners** stays. Community relationships are a leading signal.
- **Contact** stays. It becomes the primary conversion action.
- **Arcade** stays. The games showcase is a portfolio centerpiece.
- **Booking** stays but moves to the end and is framed as "coming soon" rather than a live CTA.

All pages using the shared `eo-nav` component get this update in a single pass.

---

## Phase 1 — About Us Page + Nav Update

**Delivers:** A real identity for the site. Visitors know who Stellar Aqua is and what the community mission is before they explore the platform.

### 1.1 Create `/about.html`

New page following the same paper dossier + CRT monitor hybrid layout established in `HYBRID-LAYOUT-SPEC.md` and `HOME-V2-SPEC.md`. The folder tab reads "Intel File" or "Dossier." The page has three sections:

**Section: Stellar Aqua**
Who we are. Not a corporate bio — write it in the voice of the platform. The same dry-intel tone the terminal uses. A paragraph or two. What Stellar Aqua builds, for who, and why community is the organizing principle.

**Section: The Platform**
What flapsandseals.com is. A showcase of what the engine can do — not a promise about what the exercise program will do. This is the place to reference the game engine, the roguelike, the designer portals, and the ARG infrastructure as capabilities, not products. A few sentences per capability, linking into the relevant section of the site (→ Arcade, → Contact).

**Section: The Mission**
The live exercise program in development. The Chamber of Commerce partnership. The vision for community-based play. This section is honest that the exercises are coming, not here yet. It turns "we're not ready" into "we're building something worth waiting for."

### 1.2 Nav Update (All Pages)

Update `eo-nav` in every HTML file that includes it:
- Add `About` as the first nav link (→ `/about.html`)
- Move `Booking` to the end
- Apply to: `index.html`, `booking.html`, `partners.html`, `contact.html`, `games.html`, and any portal pages that surface the public nav

### Phase 1 Tasks

| Task | Files |
|------|-------|
| Create `public/about.html` (dossier layout) | `public/about.html` |
| Create `public/css/about.css` (minimal, shares dossier-page.css) | `public/css/about.css` |
| Create `public/js/about.js` (section scroll, any interactive elements) | `public/js/about.js` |
| Update `eo-nav` in all HTML files | All public HTML pages |
| Write About Us copy (three sections above) | `public/about.html` |

---

## Phase 2 — Reframe Partners Page

**Delivers:** A partners page that reads as community-building proof, not a casting call.

### 2.1 Rewrite the Page Narrative

The partners page exists. What changes is the framing:

**Out:** "Are you a business, actor, or volunteer interested in supporting EyesOnly exercises?" This positions the partnership as servicing our exercise program.

**In:** "We build with the community, not for it." Lead with the Chamber of Commerce relationship as evidence, not as a recruiting pitch. The partnerships section should answer: what does Stellar Aqua bring to a community, and what kind of collaborators are we looking for?

**Section: Community Partners**
The Chamber of Commerce relationship. Stellar Aqua's community credentials. What it looks like to partner with a platform like this. This is a proof-of-values section, not a sign-up form.

**Section: Work With Us**
This replaces the three-form structure (business sign-on, legal disclaimer, contact). Collapse to one honest section: "If you're a local business, community org, or creator who wants to build something together, reach out." Route to the Contact page. Don't build a bespoke partner application form until there's enough volume to warrant one.

**Section: Coming Soon (exercises)**
One paragraph: the live exercise program is in development. When it launches, local businesses, actors, and community members will be the first to know. Sign up on the Contact page to be notified.

### 2.2 Keep from Old Roadmap

- The D1 `partner_applications` table schema (Phase 2.3) — keep it, it's useful, just don't build a form on top of it yet
- The email notification infrastructure (Phase 2.4) — keep it for Contact form submissions
- The dossier page aesthetic — already implemented and correct

### 2.3 Cut from Old Roadmap

- The three separate application forms (business sign-on form, legal disclaimer, contact — all wired to separate D1 routes)
- The legal disclaimer / liability agreement form — completely premature
- `POST /api/partners/apply` with form_type routing — defer, the volume isn't there yet

### Phase 2 Tasks

| Task | Files |
|------|-------|
| Rewrite `partners.html` copy (three sections above) | `public/partners.html` |
| Remove / collapse the three-form structure to a single "Contact Us" CTA | `public/partners.html`, `public/js/partners.js` |
| Verify CoC and Stellar Aqua references are accurate and prominent | `public/partners.html` |

---

## Phase 3 — Booking Page Pivot

**Delivers:** A booking page that's honest about where the exercise program is, preserves the Stripe infrastructure, and doesn't create false expectations.

### 3.1 Reframe the Page

The booking page is not a dead end — it's an honest preview. The page should:

- Describe what the exercise program will be (90–240 minute urban CTF, team-based, real Sandpoint geography)
- Make clear it's in development — not live yet
- Offer one action: leave your email to be notified when bookings open
- Keep the scenario spec cards (Scenario 1, Scenario 2) as teasers, not CTAs

The "Book Now" button becomes "Get Notified" or "Join the Waitlist." The scenario sections stay as atmosphere. The Stripe infrastructure stays in the codebase, configured but dormant.

### 3.2 What Stays in the Codebase (Dormant)

- Stripe account configuration (`wrangler.jsonc` secrets)
- D1 `bookings` table schema (migration `0010_booking_partners.sql`)
- `POST /api/booking/create` route — keep it, just don't surface a checkout UI yet
- The anchor routing in `splash-screen.js` (Scenario 1 → `/booking.html#scenario-1` etc.) — keep it

### 3.3 What Gets Cut Now

- The live date picker and checkout form
- The Stripe payment intent flow (Phase 4 in old roadmap)
- The travel-agency liability waiver (Phase 3.2 in old roadmap) — do not build this without legal counsel engaged, and do not build it before the exercises are live

### 3.4 Simple Interest Capture

Add a minimal email capture form on the booking page. This is a single field (`email`) + submit button. On submit: `POST /api/booking/waitlist` — inserts email into a `booking_waitlist` table (one new migration, ~3 lines of SQL). Sends a confirmation email via the email outbox infrastructure from old Phase 2.4. This is the only new backend work in this phase.

### Phase 3 Tasks

| Task | Files |
|------|-------|
| Rewrite `booking.html` copy and layout (teaser + waitlist) | `public/booking.html` |
| Add `booking_waitlist` table migration | `migrations/0011_booking_waitlist.sql` |
| Add `POST /api/booking/waitlist` route | `src/worker/routes/booking.ts` |
| Wire waitlist form to API | `public/js/booking.js` |
| Keep Stripe config dormant, remove checkout UI | `public/js/booking.js` |

---

## Phase 4 — Portfolio Framing on Games Page

**Delivers:** The `/games.html` page reads as a portfolio showcase, not just a list of playable games.

### 4.1 Add Portfolio Context

The games page currently jumps straight into game tiles. Add a brief header section (inside the CRT, above the game rows) that frames what the visitor is looking at:

- One sentence: what the ArcadeEngine is and what it enables
- One sentence: where the games come from (built here, designer portal)
- A link to the Puzzle Designer or Games Designer portal for visitors who want to see the tooling

This is copy-only — no structural changes to the hybrid layout or the game tiles.

### 4.2 Games Designer Portal as Portfolio Artifact

The games designer portal (`/puzzle-designer.html`) is a genuine portfolio piece: a non-developer can create and publish a canvas game through a CRUD editor with live preview and 6-point validation. This capability deserves a visible path from the main site.

Add a "Build a Game" or "Designer Portal" link in the sticky-note nav on `/games.html` (the `⚙ DESIGNER` link already exists in the `HYBRID-LAYOUT-SPEC.md` spec — make sure it's prominent and that it points to the games designer section of the unified designer).

### Phase 4 Tasks

| Task | Files |
|------|-------|
| Write portfolio context header copy for games page | `public/games.html` |
| Verify Designer Portal link is prominent in sticky-note nav | `public/games.html` |
| Confirm `/puzzle-designer.html` is accessible without login (or add a guest/demo mode note) | `public/puzzle-designer.html` |

---

## Phase 5 — Email Infrastructure (Shared)

**Delivers:** Contact and waitlist submissions actually reach people.

This phase pulls the email utility work from old roadmap Phase 2.4 and scopes it for the current, simpler use case: Contact form submissions and waitlist signups.

### 5.1 Email Utility

Create `src/worker/utils/email.ts` with an `enqueueEmail(to, subject, bodyHtml)` function that inserts into the `email_outbox` table. The scheduled cron trigger (already configured at `*/5 minutes`) flushes the outbox via the chosen provider.

Provider recommendation: **Resend** — lowest friction, excellent Cloudflare Workers support, free tier handles the volume here.

### 5.2 Destinations

| Trigger | To | Subject |
|---------|----|---------|
| Contact form submission | `ramoneez@yahoo.com` | New contact: [name] |
| Contact form submission | Submitter's email | We got your message |
| Waitlist signup | `ramoneez@yahoo.com` | New waitlist signup: [email] |
| Waitlist signup | Submitter's email | You're on the list |
| Partner inquiry (if re-enabled later) | `ramoneez@yahoo.com` | Partner inquiry: [name] |

### Phase 5 Tasks

| Task | Files |
|------|-------|
| Add `email_outbox` migration if not already present | `migrations/` |
| Create `src/worker/utils/email.ts` with `enqueueEmail()` | `src/worker/utils/email.ts` |
| Configure Resend (or chosen provider) in `wrangler.jsonc` | `wrangler.jsonc` |
| Wire Contact form submit to `enqueueEmail()` | `src/worker/routes/contact.ts` |
| Wire waitlist signup to `enqueueEmail()` | `src/worker/routes/booking.ts` |

---

## What Stays Deferred

These items from the old roadmap are not cut — they're preserved for the moment the exercise program actually launches. At that point they become the right next thing to build.

| Old Roadmap Item | Status | Resume When |
|-----------------|--------|-------------|
| Full Stripe checkout flow (old Phase 4) | Deferred | Exercise program is live and bookings are open |
| Travel-agency liability waiver (old Phase 3.2) | Deferred + requires legal review | Legal counsel engaged, exercises operationally ready |
| Three-form partner application system (old Phase 3.3) | Deferred | Partner volume justifies the forms |
| `POST /api/partners/apply` with form_type routing | Deferred | Partner volume justifies the route |
| Date picker + player count + group info booking form | Deferred | Exercises are scheduled and taking signups |

---

## Execution Order

```
Phase 1 (About Us + Nav)
    ↓ immediately unblocks identity for all visitors
Phase 2 (Partners Reframe)
    ↓ quick — copy rewrite + form collapse, no new backend
Phase 3 (Booking Pivot)
    ↓ small — one migration, one API route, copy rewrite
Phase 4 (Games Portfolio Context)
    ↓ copy-only, can run in parallel with Phase 2-3
Phase 5 (Email Infrastructure)
    ↓ shared dependency for Contact + Waitlist; do after Phase 3
```

Phases 1–3 are a single developer sprint. Phase 4 is afternoon work. Phase 5 is a half-day with provider setup.

---

## Copy Direction Reference

The voice across all new copy should be consistent with what's already established on the site: dry, intel-brief, specific. Not corporate, not startup-enthusiastic, not escape-room promotional.

**Avoid:** "Join us for an immersive spy experience!" / "Book your adventure today!" / "We're passionate about community!"

**Use:** "Stellar Aqua builds interactive platforms for community play." / "The exercise program is in development. When it opens, it will be here." / "The Chamber of Commerce partnership is one of several community relationships that inform how this platform is designed."

The site has a distinct voice. The new pages should fit into it, not break from it.

---

*Document Version: 1.0*
*Created: 2026-05-01*
*Supersedes: `docs/BOOKING_PARTNERS_ROADMAP.docx` (framing only — infrastructure spec in that doc remains valid for future phases)*
