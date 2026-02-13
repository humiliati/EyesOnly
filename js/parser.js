/* ============================================================
   EYES ONLY - Command Parser
   Handles command recognition, aliases, hidden triggers,
   and input normalization. Adapted from langterm's input
   handling pattern but extended for ARG interaction.
   ============================================================ */

const Parser = (function () {
  'use strict';

  /**
   * Known command definitions.
   * Each command has: aliases (accepted inputs), the canonical name,
   * and whether it's hidden (not shown in help).
   */
  const COMMANDS = [
    // Clearance gate commands
    { name: 'CLEARANCE',  aliases: ['clearance', 'clr'],                hidden: false },
    { name: 'ACCESS',     aliases: ['access', 'acc'],                   hidden: false },
    { name: 'EYES_ONLY',  aliases: ['eyes only', 'eyesonly', 'eo'],     hidden: false },
    { name: 'AUTH',       aliases: ['auth', 'authenticate', 'login'],   hidden: false },

    // Responses
    { name: 'YES',        aliases: ['y', 'yes', 'affirmative', 'da'],   hidden: false },
    { name: 'NO',         aliases: ['n', 'no', 'negative', 'nyet'],     hidden: false },

    // Hidden commands (discoverable through ARG play)
    { name: 'FALCON',    aliases: ['falcon', 'the falcon'],             hidden: true },
    { name: 'SNOWMAN',   aliases: ['snowman', 'the snowman'],           hidden: true },
    { name: 'SUBMERGED', aliases: ['submerged', 'submarine', 'sub'],    hidden: true },
    { name: 'STATUS',    aliases: ['status', 'stat'],                   hidden: true },
    { name: 'DOSSIER',   aliases: ['dossier', 'file', 'files'],        hidden: true },
    { name: 'MAP',       aliases: ['map', 'grid', 'sector'],           hidden: true },
    { name: 'HELP',      aliases: ['help', '?', 'commands'],           hidden: true },
    { name: 'CLEAR',     aliases: ['clear', 'cls'],                    hidden: true },
    { name: 'AMBER',     aliases: ['amber', 'phosphor amber'],         hidden: true },
    { name: 'GREEN',     aliases: ['green', 'phosphor green'],         hidden: true },
    { name: 'RESET',     aliases: ['reset', 'purge', 'wipe'],          hidden: true },
    { name: 'MISSIONS',  aliases: ['missions', 'mission', 'nodes'],    hidden: true },

    // "Normal website" commands - things regular users might try
    { name: 'ABOUT',     aliases: ['about', 'about us', 'aboutus', 'who', 'who are you', 'info', 'credits'],  hidden: true },
    { name: 'HOME',      aliases: ['home', 'homepage', 'main', 'start', 'back', 'return', 'exit', 'quit', 'logout', 'logoff', 'log out'],  hidden: true },
    { name: 'CONTACT',   aliases: ['contact', 'contact us', 'contactus', 'email', 'book', 'book now', 'booknow', 'booking', 'reserve', 'signup', 'sign up', 'register'],  hidden: true },
    { name: 'MENU',      aliases: ['menu', 'nav', 'navigation', 'sitemap', 'site map', 'links', 'pages'],  hidden: true },
    { name: 'SHOP',      aliases: ['shop', 'store', 'buy', 'purchase', 'order', 'merch', 'merchandise', 'cart'],  hidden: true },
    { name: 'SOCIAL',    aliases: ['facebook', 'instagram', 'twitter', 'x', 'tiktok', 'youtube', 'social', 'follow'],  hidden: true },
    { name: 'FAQ',       aliases: ['faq', 'questions', 'how', 'how does this work', 'what is this', 'explain', 'wtf', 'huh'],  hidden: true },
    { name: 'SANDPOINT', aliases: ['sandpoint', 'idaho', 'chamber', 'chamber of commerce', 'tourism', 'visit', 'travel'],  hidden: true },
  ];

  /**
   * Normalize raw input for matching.
   * Strips extra whitespace, lowercases, removes special chars.
   */
  function _normalize(raw) {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parse a raw input string into a command result.
   * Returns: { command: string|null, raw: string, normalized: string, args: string[] }
   */
  function parse(raw) {
    var normalized = _normalize(raw);
    var result = {
      command: null,
      raw: raw,
      normalized: normalized,
      args: normalized.split(' ')
    };

    // Try to match against known commands
    for (var i = 0; i < COMMANDS.length; i++) {
      var cmd = COMMANDS[i];
      for (var j = 0; j < cmd.aliases.length; j++) {
        if (normalized === cmd.aliases[j]) {
          result.command = cmd.name;
          return result;
        }
      }
    }

    // Check if input is a numeric code (for temporal key, mission codes)
    if (/^\d+$/.test(normalized)) {
      result.command = 'NUMERIC';
      return result;
    }

    // Check if input could be a mission code (alphanumeric, 4-12 chars)
    if (/^[a-z0-9]{4,12}$/.test(normalized.replace(/\s/g, ''))) {
      result.command = 'CODE';
      return result;
    }

    // Unrecognized input
    result.command = 'UNKNOWN';
    return result;
  }

  /**
   * Check if a raw input matches a specific expected value.
   * Used for designation checks, codes, etc.
   */
  function matches(raw, expected) {
    return _normalize(raw) === _normalize(expected);
  }

  /**
   * Get list of non-hidden commands (for contextual hints).
   */
  function getVisibleCommands() {
    return COMMANDS
      .filter(function (c) { return !c.hidden; })
      .map(function (c) { return c.name; });
  }

  /**
   * Get list of hidden commands (for debug/admin).
   */
  function getHiddenCommands() {
    return COMMANDS
      .filter(function (c) { return c.hidden; })
      .map(function (c) { return c.name; });
  }

  return {
    parse: parse,
    matches: matches,
    normalize: _normalize,
    getVisibleCommands: getVisibleCommands,
    getHiddenCommands: getHiddenCommands
  };
})();
