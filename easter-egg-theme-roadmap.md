What's styled (white/off-white/light-grey):

Header nav buttons — BOOKING, PARTNERS, CONTACT, ARCADE, and the AWOL chip
Left column / torso buttons — BACK, ITEMS, LOGIN, KERNEL (disabled state), HELP, SCORE
History button (▼ HISTORY) — white button floated in the dark MOK bar
Overall shell — crt-frame, monitor body, header bar, sidebar all go off-white/light-grey
Scanlines/vignette/phosphor-glow — suppressed for the theme

Left as native phosphor-green monitors:

#log-column (terminal/game window)
.debrief-window (the video feed)
#mok-interjections (MOK tooltip bar — only the History button gets the white chip treatment)


CSS to save as theme-easter-egg-white.css (or inject via your theme loader):
css/* ═══════════════════════════════════════════════════
   EASTER EGG: WHITE THEME  
   All-white, off-white, light-grey shell 
   Monitor windows (log-column, debrief, tooltip/MOK)
   are left in their original phosphor-green state.
   ═══════════════════════════════════════════════════ */

/* ── CRT SHELL & BODY ─────────────────────────────── */
#crt-screen,
#crt-frame,
#monitor-shell,
#monitor-body {
  background: #e8eaeb !important;
  border-color: #b0b8be !important;
  box-shadow: 0 0 0 3px #ccd0d4, 0 8px 40px rgba(0,0,0,0.18) !important;
}

#phosphor-glow,
#scanlines,
#vignette {
  opacity: 0 !important;
  display: none !important;
}

/* ── MONITOR HEADER BAR ───────────────────────────── */
#mok-header.monitor-header,
.monitor-header {
  background: #f5f5f5 !important;
  border-bottom: 1.5px solid #c8ced4 !important;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08) !important;
  color: #2a2a2a !important;
}

/* ── WHITE BUTTON BASE (UIverse fast-puma-20 inspired) ── */
.header-chip.header-nav-btn,
.header-chip.accountability-indicator,
#control-rail button:not(.audio-btn):not(.audio-mute-toggle),
#mok-history-toggle {
  background: #ccd0d4 !important;
  color: #2a2e33 !important;
  border: none !important;
  border-radius: 8px !important;
  letter-spacing: 1.5px !important;
  text-transform: uppercase !important;
  font-family: "Courier New", Consolas, monospace !important;
  cursor: pointer !important;
  position: relative !important;
  overflow: hidden !important;
  text-decoration: none !important;
  box-shadow:
    inset 0 0 18px 3px rgba(0, 0, 0, 0.14),
    inset 0 2px 1px 1px rgba(255, 255, 255, 0.92),
    inset 0 -2px 1px 0 rgba(0, 0, 0, 0.18),
    0 1px 4px rgba(0,0,0,0.10) !important;
  transition: all 220ms cubic-bezier(0.23, 1, 0.32, 1) !important;
}

/* Glow orb pseudo-element */
.header-chip.header-nav-btn::before,
.header-chip.accountability-indicator::before,
#control-rail button:not(.audio-btn):not(.audio-mute-toggle)::before,
#mok-history-toggle::before {
  content: "" !important;
  position: absolute !important;
  border-radius: 50% !important;
  background: #fff !important;
  box-shadow: 0 0 10px 5px #fff !important;
  opacity: 0.18 !important;
  width: 60% !important;
  height: 60% !important;
  left: 50% !important;
  top: 50% !important;
  margin-left: -30% !important;
  margin-top: -30% !important;
  pointer-events: none !important;
}

/* Hover */
.header-chip.header-nav-btn:hover,
.header-chip.accountability-indicator:hover,
#control-rail button:not(.audio-btn):not(.audio-mute-toggle):hover,
#mok-history-toggle:hover {
  background: #dce0e4 !important;
  color: #111 !important;
  box-shadow:
    inset 0 0 18px 3px rgba(0, 0, 0, 0.10),
    inset 0 2px 1px 1px rgba(255, 255, 255, 0.98),
    inset 0 -2px 1px 0 rgba(0, 0, 0, 0.12),
    0 2px 10px rgba(0,0,0,0.15),
    0 0 0 1.5px rgba(255,255,255,0.7) !important;
  transform: translateY(-1px) !important;
}

/* Active/pressed */
.header-chip.header-nav-btn:active,
.header-chip.accountability-indicator:active,
#control-rail button:not(.audio-btn):not(.audio-mute-toggle):active,
#mok-history-toggle:active {
  background: #b8bec4 !important;
  box-shadow:
    0 15px 25px -4px rgba(0, 0, 0, 0.3),
    inset 0 -8px 30px 1px rgba(255, 255, 255, 0.7),
    0 -6px 10px -1px rgba(255, 255, 255, 0.5),
    inset 0 8px 25px 0 rgba(0, 0, 0, 0.28),
    inset 0 0 10px 1px rgba(255, 255, 255, 0.5) !important;
  transform: translateY(1px) !important;
}

/* ── HEADER NAV sizing ── */
.header-chip.header-nav-btn {
  padding: 5px 12px !important;
  font-size: 11px !important;
}

/* ── CONTROL RAIL (left column / torso) ── */
#control-rail {
  background: #eaecee !important;
  border-right: 1.5px solid #c8ced4 !important;
}

#control-rail button:not(.audio-btn):not(.audio-mute-toggle) {
  width: calc(100% - 12px) !important;
  margin: 3px 6px !important;
  padding: 8px 6px !important;
  font-size: 12px !important;
  display: block !important;
}

/* Audio controls — subtle light treatment */
#control-rail .audio-btn,
#control-rail .audio-mute-toggle {
  background: #dde0e3 !important;
  color: #444 !important;
  border: 1px solid #bcc0c5 !important;
}

/* ── HISTORY BUTTON ── */
#mok-history-toggle {
  padding: 3px 10px !important;
  font-size: 10px !important;
  border-radius: 4px !important;
}

/* ── KERNEL (locked/disabled) ── */
.kernel-btn[disabled],
.kernel-btn:disabled {
  background: #d8dadc !important;
  color: #9aa0a6 !important;
  box-shadow:
    inset 0 0 10px 2px rgba(0,0,0,0.08),
    inset 0 1px 1px rgba(255,255,255,0.6) !important;
  cursor: not-allowed !important;
}

/* ── PAGE BACKGROUND ── */
body {
  background: #d4d8dc !important;
}

/* ═══════════════════════════════════════════════════
   MONITOR WINDOWS — PRESERVED (green phosphor):
   #log-column  ·  .debrief-window  ·  #mok-interjections
   (only #mok-history-toggle gets the white treatment)
   ═══════════════════════════════════════════════════ */
Button selectors breakdown:
TargetSelectorHeader nav (BOOKING etc.).header-chip.header-nav-btnAWOL chip.header-chip.accountability-indicatorLeft column buttons#control-rail button:not(.audio-btn):not(.audio-mute-toggle)History button#mok-history-toggle
The UIverse effect is the inset tri-shadow combo (inset 0 2px white, inset 0 -2px dark, inset radial dark center) on a #ccd0d4 base — gives that plasticky raised-button feel without needing the full toggle structure.this is almost perfect we have a little coherence to take care of.the debreif feed frame is not plastic white, it's still the dark themethe log-column frame needs the debreif feed frame's treatment to plastic whitethere's still a crt monitor darkening overlay covering the top 90% of the screen46 steps46 stepsAll three issues are fixed and looking cohesive. Here's what was corrected and the CSS patch to add to the stylesheet:

What was fixed:

CRT dark overlay — #crt-screen::before was a pseudo-element generating a massive rgba(0,0,0,0.7) inset box-shadow vignette covering the whole screen. Suppressed it.
Debrief feed frame — .debrief-window had a linear-gradient(rgba(10,18,12,0.9)...) background. Now plastic white. The inner .debrief-screen (the green video monitor) is untouched.
Log-column frame — .log-frame (the div wrapping #terminal) had rgb(12,16,24) background. Now plastic white bezel. The inner #terminal monitor stays dark.


Append this to your theme-easter-egg-white.css:
css/* ══════════════════════════════════════════════
   EASTER EGG WHITE THEME — FIX PATCH
   ══════════════════════════════════════════════ */

/* ── FIX 1: Suppress the #crt-screen::before dark vignette ── */
#crt-screen::before {
  box-shadow: none !important;
  background: none !important;
  display: none !important;
}

/* ── FIX 2: Debrief feed FRAME → plastic white bezel ── */
.debrief-window {
  background: #e0e3e6 !important;
  border: 1.5px solid #b8bec4 !important;
  border-radius: 10px !important;
  box-shadow:
    inset 0 0 18px 3px rgba(0, 0, 0, 0.10),
    inset 0 2px 1px 1px rgba(255, 255, 255, 0.92),
    inset 0 -2px 1px 0 rgba(0, 0, 0, 0.14),
    0 2px 8px rgba(0,0,0,0.12) !important;
}

.debrief-window .debrief-label {
  color: #4a5260 !important;
  letter-spacing: 0.12em !important;
}

/* .debrief-screen (inner monitor) — intentionally NOT overridden */

/* ── FIX 3: Log-column FRAME → plastic white bezel ── */
#log-column .log-frame {
  background: #e0e3e6 !important;
  border: 1.5px solid #b8bec4 !important;
  border-radius: 10px !important;
  box-shadow:
    inset 0 0 20px 4px rgba(0, 0, 0, 0.10),
    inset 0 2px 1px 1px rgba(255, 255, 255, 0.92),
    inset 0 -2px 1px 0 rgba(0, 0, 0, 0.14),
    0 2px 10px rgba(0,0,0,0.12) !important;
}

#log-column {
  background: transparent !important;
  border: none !important;
}

/* #terminal (inner monitor) — intentionally NOT overridden */
The key culprit for the darkness was #crt-screen::before — it's separate from #scanlines/#vignette (which we already hid) and wasn't caught in the first pass. The bezel inset treatment on both .log-frame and .debrief-window now matches the #control-rail plastic white feel perfectly.let's clean up the layers and framing so that it's all the elements are more uniform. the frame around log-column looks shiny the frame around the left column and log-column has square corners. the mok-interjection tooltip window needs to be about ~50% less tall and have it's frame like the log-column with the history button an on-screen element appearing like hyperlink text, in the theme's console font, with a console button frame instead of a plastic buttonthese changes will apply to all themes44 steps44 stepsEverything is looking cohesive now. Here's a summary of what changed and the full CSS to integrate:
What was fixed:

Log-frame shiny highlight removed — the rgba(255,255,255,0.92) inset was stripped from both #control-rail and .log-frame, replaced with a softer uniform matte inset shadow
Rounded corners unified — #control-rail, .log-frame, and #mok-interjections all now use border-radius: 10px, matching the outer #crt-frame (12px)
MOK interjection bar — reduced from ~66px to ~32px (>50%) by hiding the "MOK INTERJECTION" label and tightening padding; given the same inset panel-bezel treatment as the log-frame; uses var(--panel-bg) so it adapts to all themes
History button — stripped of all plastic button styles; now renders as lowercase console hyperlink text (▼ history) with a 1px border-only console frame, no fill, underlined, in the theme's monospace font and primary color


BASE stylesheet changes (all themes) — style-base.css or equivalent:
css/* ═══════════════════════════════════════════════════════
   BASE LAYOUT CORRECTIONS — all themes
   ═══════════════════════════════════════════════════════ */

/* ── Unified matte inset on panel bezels ── */
#control-rail {
  border-radius: 10px;
  box-shadow: rgba(0, 0, 0, 0.38) 0px 0px 10px 0px inset;
}

.log-frame {
  border-radius: 10px;
  box-shadow: rgba(0, 0, 0, 0.38) 0px 0px 12px 0px inset;
}

*******THE FOLLOWING IS WRONG*************
/* ── MOK interjection bar: smaller + same panel treatment ── */
#mok-interjections {
  background: var(--panel-bg, rgba(8, 12, 8, 0.95));
  background-image: none;
  border: 1px solid var(--panel-border-soft, rgba(51,255,51,0.15));
  border-radius: 10px;
  padding: 3px 10px;
  min-height: 0;
  box-shadow: rgba(0, 0, 0, 0.38) 0px 0px 10px 0px inset;
  overflow: hidden;
}

.interject-label {
  display: none; /* removes "MOK INTERJECTION" label to save height */
}

.interject-body {
  font-size: 0.82em;
  line-height: 1.3;
}

.mok-footer-controls {
  margin-top: 1px;
}

/* ── History toggle: console hyperlink, not plastic button ── */
.mok-history-toggle {
  background: transparent;
  border: 1px solid var(--theme-panel-border, var(--panel-border-soft, rgba(51,255,51,0.2)));
  border-radius: 2px;
  box-shadow: none;
  font-family: var(--theme-font-data, "Courier New", Consolas, monospace);
  font-size: 0.78em;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  color: var(--theme-primary, var(--phosphor-dim, #1a9c1a));
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: var(--theme-primary, var(--phosphor-dim, #1a9c1a));
  padding: 1px 6px;
  cursor: pointer;
  opacity: 0.85;
  float: right;
  transition: opacity 0.15s, color 0.15s;
}

.mok-history-toggle:hover {
  opacity: 1;
  color: var(--theme-primary, var(--phosphor, #33ff33));
  background: transparent;
  box-shadow: none;
}

.mok-history-toggle:active {
  opacity: 0.7;
  background: transparent;
  box-shadow: none;
}

/* ── Log column flex layout ── */
#log-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
Easter egg white theme additions (in your white theme file, after the base):
css/* White theme overrides for mok-interjections */
#mok-interjections {
  background: #e0e3e6 !important;
  background-image: none !important;
  border: 1.5px solid #b8bec4 !important;
  box-shadow:
    inset 0 0 18px 3px rgba(0, 0, 0, 0.10),
    inset 0 2px 1px 1px rgba(255, 255, 255, 0.92),
    inset 0 -2px 1px 0 rgba(0, 0, 0, 0.14) !important;
}

.mok-history-toggle {
  color: #3a4a5a !important;
  border-color: #9aa6b2 !important;
  text-decoration-color: #3a4a5a !important;
}

.interject-body {
  color: #2a3a4a !important;
  text-shadow: none !important;
}

********************DO NOT COPY********************************************