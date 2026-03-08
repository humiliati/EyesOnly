# Musician Commissioning Brief: "EyesOnly" Soundtrack

> **Date:** 2026-03-08 (last updated)

---

## 1. Project Overview

- **Game Type:** Stealth / Grid Simulation (10 FPS logic tick)
- **Platform:** Mobile Browser (DOM + Canvas)
- **Aesthetic:** "Pink Panther meets 8-bit." Playful, stealthy, jazz-influenced chiptune.
- **Technical Constraint:** Assets must be lightweight for low-end mobile devices. Memory is tight.

---

## 2. Artistic Direction & Palette

**Vibe:** Sneaky, playful, tense but not horror-heavy. Think "cartoon spy" rather than "military shooter."

**Instrumentation:**

- **Lead:** Square/Pulse waves (melody), distinct and plucky.
- **Bass:** Triangle or Sawtooth (driving the stealth rhythm).
- **Percussion:** Sparse. Noise channel for snares/hats. Kick should be punchy but short (to avoid mud).
- **Harmony:** Jazz-influenced chords (minor 7ths, diminished) to evoke the "Pink Panther" stealth feel, but synthesized via chiptune tools.

**Reference Tracks:**

- Henry Mancini — *The Pink Panther Theme* (for rhythm/humor)
- *Shovel Knight* OST (for modern chiptune mixing)
- *Metal Gear Solid* (NES) (for stealth tension)

---

## 3. Track List & Requirements

All music must be delivered with **seamless loop points** defined.

| Track ID | State | Duration | Loopable | Mood | Notes |
|---|---|---|---|---|---|
| MNU_MAIN | Menu | 60s+ | Yes | Intriguing | Needs a strong hook. Low energy. |
| MUS_EXPLORE | Stealth | 90s+ | Yes | Tense/Quiet | Leave frequency space for SFX. |
| MUS_COMBAT | Alert | 60s+ | Yes | Chaotic/Fast | Higher BPM. Must crossfade with Explore. |
| MUS_BOSS | Boss | 90s+ | Yes | Oppressive | Heavier bass, distinct melody. |
| SFX_PACK | UI/Feedback | N/A | No | Crisp | See Section 5. |

---

## 4. Technical Deliverables (Strict)

To ensure performance on low-end Android devices, please adhere to these export settings:

- **Sample Rate:** 44.1kHz (Standard) or 22.05kHz (Preferred for retro feel + size savings)
- **Bit Depth:** 16-bit PCM (WAV for archive, we will compress)
- **Format:** Please provide WAV masters. We will handle Opus/WebM + MP3 compression internally to ensure loop points align perfectly.
- **Loop Points:** Please provide a text file or marker track indicating exact start/end samples for seamless looping.
- **Stems (Optional but Recommended):** If possible, provide separate stems for Melody and Rhythm/Bass. This allows us to dynamically mute the melody during high-tension moments without stopping the rhythm.
- **File Size Target:** Each music loop < 1.5 MB (uncompressed).

---

## 5. SFX Design List (Short & Crisp)

All SFX must be **≤ 300ms** to prevent overlap mud.

| ID | Event | Description |
|---|---|---|
| SFX_UI_HOVER | Menu Nav | Soft click/blip |
| SFX_UI_SELECT | Confirm | Higher pitch blip |
| SFX_ALERT | Enemy Spot | Rising tone (Shepard tone effect preferred) |
| SFX_STEP | Player Move | Very subtle thud (optional, can be disabled) |
| SFX_HIT | Damage | Low thud/crash |
| SFX_WIN | Level Clear | Major chord arpeggio (ascending) |
| SFX_LOSE | Game Over | Descending discordant tone |

---

## 6. Implementation Notes for the Composer

- **Dynamic Range:** Keep compression moderate. Mobile speakers have low dynamic range; too much quiet detail will be lost, too much peak will clip.
- **Frequency Masking:** Avoid heavy content in the 2kHz–4kHz range during exploration music, as this is where human hearing is most sensitive to alerts (SFX).
- **Crossfade Compatibility:** MUS_EXPLORE and MUS_COMBAT should ideally share the same BPM and Key. This allows us to crossfade between them without musical clash during state transitions.

---

## 7. Current Asset Pipeline

Once WAV masters are received, our internal pipeline handles conversion and deployment:

1. **Transcode:** `scripts/transcode-audio.sh` converts WAV → Opus/WebM (primary) + MP3 (Safari fallback)
2. **Upload:** `scripts/upload-audio-to-r2.sh` batch-uploads to Cloudflare R2 (`eyesonly-assets` bucket)
3. **Register:** Add entries to `public/audio/audio-manifest.json` with sound ID, source path, category, and metadata
4. **Deploy:** `npx wrangler deploy` pushes the updated worker + manifest to production

See `docs/AUDIO_WIRING_ROADMAP.md` for the full portal-to-deployment pipeline documentation.
