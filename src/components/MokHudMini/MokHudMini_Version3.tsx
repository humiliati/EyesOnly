import { useEffect, useRef, useState } from "preact/hooks";
import "./MokHudMini.css";

/**
 * MokHudMini
 * - Displays the MOK indicator (fits small header area).
 * - Props:
 *    width, height (px) - default 220x48
 *    onPrintToOps: (payload) => void  // called when MOK prints to the ops chat feed
 *    onBroadcast: (payload) => void   // called when M requests broadcast conversion
 *    audioEnabled?: boolean           // optional synth tick
 */
export type MOKMessageType = "advisory" | "warning" | "directive" | "critical";

export type SquelchMode = "full" | "quiet" | "silent" | "tactical";

export default function MokHudMini({
  width = 220,
  height = 48,
  onPrintToOps,
  onBroadcast,
  audioEnabled = false,
}: {
  width?: number;
  height?: number;
  onPrintToOps?: (payload: { type: MOKMessageType; text: string; timestamp: number }) => void;
  onBroadcast?: (payload: { text: string; source?: string }) => void;
  audioEnabled?: boolean;
}) {
  // visual state: idle | monitoring | advisory | urgent | engaged
  const [visualState, setVisualState] = useState<"idle" | "monitoring" | "advisory" | "urgent" | "engaged">("idle");
  const [squelch, setSquelch] = useState<SquelchMode>("full");
  const minimizedRef = useRef(false);

  // small audio context for subtle ticks (optional)
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (audioEnabled && typeof window !== "undefined") {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        audioCtxRef.current = null;
      }
    }
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [audioEnabled]);

  // Trigger a subtle tick pulse
  function tickSound(urgent = false) {
    if (!audioEnabled || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = urgent ? 440 : 280;
    g.gain.value = urgent ? 0.02 : 0.008;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (urgent ? 0.18 : 0.28));
    o.stop(ctx.currentTime + (urgent ? 0.2 : 0.3));
  }

  // Print a MOK message to ops feed and trigger visuals
  function sendMokMessage(type: MOKMessageType, text: string) {
    const ts = Date.now();
    // squash messages if squelch mode is silent
    if (squelch === "silent") {
      // visual flash still occurs (triangle flashes silently)
      triggerVisualForType(type);
      return;
    }

    // quiet mode => only critical
    if (squelch === "quiet" && type !== "critical") {
      triggerVisualForType(type, /*visualOnly*/ true);
      return;
    }

    // tactical => only actionable suggestions (directive)
    if (squelch === "tactical" && type !== "directive" && type !== "critical") {
      triggerVisualForType(type, /*visualOnly*/ true);
      return;
    }

    // call the host to print into ops feed
    onPrintToOps?.({ type, text, timestamp: ts });

    // optionally trigger a broadcast UI or action
    // (host decides when to call onBroadcast)
    triggerVisualForType(type);

    // subtle audio
    tickSound(type === "critical" || type === "warning");
  }

  // Visual trigger mapping
  function triggerVisualForType(type: MOKMessageType, visualOnly = false) {
    if (type === "advisory") {
      setVisualState("advisory");
      // return to monitoring after a short delay
      window.setTimeout(() => setVisualState("monitoring"), 2000);
    } else if (type === "warning") {
      setVisualState("advisory");
      window.setTimeout(() => setVisualState("monitoring"), 2200);
      if (!visualOnly) tickSound(false);
    } else if (type === "directive") {
      setVisualState("advisory");
      window.setTimeout(() => setVisualState("monitoring"), 2400);
    } else {
      // critical
      setVisualState("urgent");
      window.setTimeout(() => setVisualState("monitoring"), 3000);
      tickSound(true);
    }
  }

  // External control functions (exposed via DOM events or forwarded refs in your app)
  // Set squelch modes, enable auto director, minimize, etc.
  function setSquelchMode(mode: SquelchMode) {
    setSquelch(mode);
  }

  function engageAutoDirector(engage: boolean) {
    setVisualState(engage ? "engaged" : "monitoring");
  }

  function minimize(min: boolean) {
    minimizedRef.current = min;
  }

  // Example small API on window for testing (remove in production)
  useEffect(() => {
    // attach for quick dev testing; you can remove or replace with proper integration
    (window as any)._MOK = {
      send: sendMokMessage,
      setSquelch: setSquelchMode,
      engageAutoDirector,
    };
    return () => {
      delete (window as any)._MOK;
    };
  }, [squelch]);

  // classes by visual state
  const containerClass = `mok-hud-mini ${visualState}`;

  return (
    <div
      className={containerClass}
      style={{ width: `${width}px`, height: `${height}px` }}
      role="img"
      aria-label={`MOK Director indicator. State: ${visualState}`}
    >
      {/* Inline SVG so CSS can toggle classes / animations */}
      <svg viewBox="0 0 220 48" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" className="mok-svg">
        <defs>
          <pattern id="mok-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="#05260a" strokeWidth="0.5"/>
          </pattern>
          <linearGradient id="mok-glow" x1="0" x2="1">
            <stop offset="0" stopColor="#16ff8f" stopOpacity="0.95"/>
            <stop offset="1" stopColor="#004e2a" stopOpacity="0.6"/>
          </linearGradient>
          <filter id="mok-blur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" result="b"/>
            <feMerge>
              <feMergeNode in="b"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <mask id="triangle-core-mask">
            {/* By default the triangle center is transparent (hollow) */}
            <rect x="0" y="0" width="220" height="48" fill="white" />
            {/* Small triangle cutout in mask centre (becomes visible by toggling a class that fills it) */}
            <g id="core-cutout" transform="translate(110,24)">
              <path d="M0 -16 L-10 6 L10 6 Z" fill="black" />
            </g>
          </mask>
        </defs>

        <rect x="1" y="1" rx="6" ry="6" width="218" height="46" fill="rgba(0,0,0,0.5)" stroke="#083212" strokeWidth="1.5"/>
        <rect x="6" y="6" width="208" height="36" fill="url(#mok-grid)" opacity="0.86"/>
        <rect x="-80" y="0" width="120" height="48" fill="url(#mok-glow)" opacity="0.06" className="mok-glow-band"/>

        {/* glyph group */}
        <g transform="translate(110,24)" className="mok-glyph" aria-hidden="true">
          {/* outer inverted pentagon-ish / visor */}
          <path d="M-42 -2 L-22 -20 L22 -20 L42 -2 L-42 -2 Z" fill="url(#mok-glow)" opacity="0.8" filter="url(#mok-blur)"/>
          {/* inner triangle (center); its fill/opacity will be toggled via classes */}
          <path className="mok-triangle-core" d="M0 -16 L-10 6 L10 6 Z" fill="#00ff88" opacity="0.98"/>
          {/* lower trapezoid detail */}
          <path d="M-12 8 L12 8 L6 14 L-6 14 Z" fill="#00b36a" opacity="0.95"/>
        </g>

        <rect x="4" y="4" rx="5" ry="5" width="212" height="40" fill="none" stroke="rgba(0,255,160,0.06)" strokeWidth="1"/>
        {/* scanlines */}
        <g opacity="0.06">
          <rect x="6" y="6" width="208" height="1" fill="#000"/>
          <rect x="6" y="10" width="208" height="1" fill="#000"/>
          <rect x="6" y="14" width="208" height="1" fill="#000"/>
          <rect x="6" y="18" width="208" height="1" fill="#000"/>
          <rect x="6" y="22" width="208" height="1" fill="#000"/>
          <rect x="6" y="26" width="208" height="1" fill="#000"/>
          <rect x="6" y="30" width="208" height="1" fill="#000"/>
          <rect x="6" y="34" width="208" height="1" fill="#000"/>
        </g>
      </svg>

      {/* Hidden interactive controls for accessibility / testing (replace with real UI controls elsewhere) */}
      <div className="mok-controls" aria-hidden="true">
        <button onClick={() => setSquelch("full")}>Squelch: full</button>
        <button onClick={() => setSquelch("quiet")}>quiet</button>
        <button onClick={() => setSquelch("tactical")}>tactical</button>
        <button onClick={() => setSquelch("silent")}>silent</button>
        <button onClick={() => engageAutoDirector(true)}>MOK ASSIST (engage)</button>
        <button onClick={() => engageAutoDirector(false)}>disengage</button>
      </div>
    </div>
  );
}