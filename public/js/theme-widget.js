/* ============================================================
   EYES ONLY - Theme Widget
   Per-device theme persistence, /theme command, swatch UI.
   Reads/writes localStorage key 'eyesonly_theme'.
   ============================================================ */

const ThemeWidget = (() => {
  'use strict';

  const STORAGE_KEY = 'eyesonly_theme';
  const THEMES = ['phosphor', 'silver', 'amber', 'panther'];
  const ALL_THEMES = ['phosphor', 'silver', 'amber', 'panther', 'white']; // includes hidden
  const DEFAULT = 'phosphor';

  const THEME_META = {
    phosphor: { label: 'PHOSPHOR', desc: 'Green CRT terminal (default)', color: '#33ff33', hidden: false },
    silver:   { label: 'SILVER',   desc: 'Steel blue intelligence dossier', color: '#b0c4de', hidden: false },
    amber:    { label: 'AMBER',    desc: 'Gold-on-black war room',          color: '#ffb000', hidden: false },
    panther:  { label: 'PANTHER',  desc: 'Magenta neon cyberpunk',          color: '#ff3090', hidden: false },
    white:    { label: 'WHITE',    desc: 'Waterproof submarine terminal',   color: '#e8eaeb', hidden: true },
  };

  /**
   * Get currently persisted theme id.
   * @returns {string}
   */
  function get() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && ALL_THEMES.includes(saved)) return saved;
    } catch (_) {}
    return DEFAULT;
  }

  /**
   * Apply a theme globally: set body attribute + persist to localStorage.
   * @param {string} themeId
   * @returns {boolean} true if applied
   */
  function apply(themeId) {
    if (!ALL_THEMES.includes(themeId)) return false;
    document.body.setAttribute('data-theme', themeId);
    try { localStorage.setItem(STORAGE_KEY, themeId); } catch (_) {}

    // Sync starfield palette to theme (skip 'white' — multi-viewport sky swap
    // is deferred until single-viewport rendering conflicts are resolved)
    if (typeof EyesOnlyStarfield !== 'undefined' && EyesOnlyStarfield.isRunning && EyesOnlyStarfield.isRunning()) {
      if (themeId !== 'white') {
        const starfieldPalette = EyesOnlyStarfield.PALETTES[themeId] ? themeId : 'night';
        EyesOnlyStarfield.setPalette(starfieldPalette);
      }
    }

    return true;
  }

  /**
   * Call as early as possible (ideally in <head>) to avoid flash of default theme.
   */
  function initEarly() {
    apply(get());
  }

  // ---- /theme Terminal Command ----

  /**
   * Check if raw input is a theme command.
   * @param {string} rawInput
   * @returns {boolean}
   */
  function isThemeCommand(rawInput) {
    if (!rawInput) return false;
    const cmd = rawInput.trim().toLowerCase().split(/\s+/)[0];
    return cmd === 'theme' || cmd === '/theme';
  }

  /**
   * Process the /theme command. Returns a router-compatible action object.
   * @param {string} rawInput
   * @returns {Object} { lines: string[], prompt: string, stayActive: boolean }
   */
  function process(rawInput) {
    const parts = (rawInput || '').trim().toLowerCase().split(/\s+/);
    const arg = parts[1] || '';
    const lines = [];

    if (!arg) {
      // List available themes
      lines.push('');
      lines.push('═══════════════════════════════════');
      lines.push('         TERMINAL THEMES');
      lines.push('═══════════════════════════════════');
      lines.push('');
      const current = get();
      THEMES.forEach((id, i) => {
        const meta = THEME_META[id];
        const marker = (id === current) ? ' ◄ ACTIVE' : '';
        lines.push('  [' + i + '] ' + meta.label + '   — ' + meta.desc + marker);
      });
      lines.push('');
      lines.push('  Usage: theme <name|number>');
      lines.push('  Example: theme amber');
      lines.push('  Example: theme 2');
      lines.push('');
      return { lines, prompt: '> ', stayActive: true };
    }

    // Accept by name or index (hidden themes work by name only)
    let targetId = null;
    const asNum = parseInt(arg, 10);
    if (!isNaN(asNum) && asNum >= 0 && asNum < THEMES.length) {
      targetId = THEMES[asNum];
    } else if (ALL_THEMES.includes(arg)) {
      targetId = arg;
    }

    if (!targetId) {
      lines.push('');
      lines.push('Unknown theme: ' + arg);
      lines.push('Available: ' + THEMES.join(', '));
      lines.push('');
      return { lines, prompt: '> ', stayActive: true };
    }

    apply(targetId);
    const meta = THEME_META[targetId];
    lines.push('');
    lines.push('Theme set: ' + meta.label);
    lines.push(meta.desc);
    lines.push('');

    return { lines, prompt: '> ', stayActive: true };
  }

  // ---- Public API ----
  return {
    get,
    apply,
    initEarly,
    isThemeCommand,
    process,
    THEMES,
    ALL_THEMES,
    THEME_META,
    DEFAULT,
  };
})();
