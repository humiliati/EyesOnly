/* ============================================================
   EYES ONLY - Command Parser
   ============================================================ */

const Parser = (function () {
  'use strict';

  const COMMANDS = [
    { name: 'CLEARANCE', aliases: ['clearance', 'clr'], hidden: false },
    { name: 'ACCESS', aliases: ['access', 'acc'], hidden: false },
    { name: 'EYES_ONLY', aliases: ['eyes only', 'eyesonly', 'eo'], hidden: false },
    { name: 'AUTH', aliases: ['auth', 'authenticate'], hidden: false },

    { name: 'YES', aliases: ['y', 'yes', 'affirmative', 'da'], hidden: false },
    { name: 'NO', aliases: ['n', 'no', 'negative', 'nyet'], hidden: false },

    { name: 'HELP', aliases: ['help', '/help', '?', 'commands'], hidden: true },
    { name: 'CLEAR', aliases: ['clear', 'cls'], hidden: true },
    { name: 'LOGIN', aliases: ['login', 'sign in'], hidden: true },
    { name: 'STREET', aliases: ['street', 'streets', 'chronicles', 'adventure', 'travel mode'], hidden: true },

    { name: 'ABOUT', aliases: ['about', 'about us', 'who', 'credits'], hidden: true },
    { name: 'HOME', aliases: ['home', 'back', 'exit', 'quit', 'logout'], hidden: true },
    { name: 'CONTACT', aliases: ['contact', 'contact us', 'book now', 'email', 'sign up'], hidden: true },
    { name: 'FAQ', aliases: ['faq', 'what is this', 'how', 'explain', 'wtf'], hidden: true },
    { name: 'SANDPOINT', aliases: ['sandpoint', 'idaho', 'chamber', 'tourism', 'visit'], hidden: true },
    { name: 'SHOP', aliases: ['shop', 'buy', 'store', 'merch', 'cart'], hidden: true },
    { name: 'MENU', aliases: ['menu', 'nav', 'sitemap', 'links'], hidden: true },
    { name: 'SOCIAL', aliases: ['facebook', 'instagram', 'twitter', 'tiktok', 'social'], hidden: true },

    { name: 'FALCON', aliases: ['falcon', 'the falcon'], hidden: true },
    { name: 'SNOWMAN', aliases: ['snowman', 'the snowman'], hidden: true },
    { name: 'SUBMERGED', aliases: ['submerged', 'submarine', 'sub'], hidden: true },
    { name: 'STATUS', aliases: ['status', 'stat'], hidden: true },
    { name: 'DOSSIER', aliases: ['dossier', 'file', 'files'], hidden: true },
    { name: 'MAP', aliases: ['map', 'grid', 'sector'], hidden: true },
    { name: 'AMBER', aliases: ['amber', 'phosphor amber'], hidden: true },
    { name: 'GREEN', aliases: ['green', 'phosphor green'], hidden: true },
    { name: 'RESET', aliases: ['reset', 'purge', 'wipe'], hidden: true },
    { name: 'MISSIONS', aliases: ['missions', 'mission', 'nodes'], hidden: true },
    { name: 'JOIN', aliases: ['join', 'enlist', 'recruit'], hidden: true },
    { name: 'OPS', aliases: ['ops', 'operations', 'field'], hidden: true },
    { name: 'DISCONNECT', aliases: ['disconnect', 'dc'], hidden: true }
  ];

  function _normalize(raw) {
    return (raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9/ ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parse(raw) {
    var normalized = _normalize(raw);
    var result = {
      command: null,
      raw: raw,
      normalized: normalized,
      args: normalized ? normalized.split(' ') : []
    };

    if (normalized.length === 0) {
      result.command = 'ENTER';
      return result;
    }

    for (var i = 0; i < COMMANDS.length; i++) {
      var cmd = COMMANDS[i];
      for (var j = 0; j < cmd.aliases.length; j++) {
        if (normalized === cmd.aliases[j]) {
          result.command = cmd.name;
          return result;
        }
      }
    }

    if (/^\d+$/.test(normalized)) {
      result.command = 'NUMERIC';
      return result;
    }

    if (/^[a-z0-9]{4,12}$/.test(normalized.replace(/\s/g, ''))) {
      result.command = 'CODE';
      return result;
    }

    result.command = 'UNKNOWN';
    return result;
  }

  function matches(raw, expected) {
    return _normalize(raw) === _normalize(expected);
  }

  return {
    parse: parse,
    matches: matches,
    normalize: _normalize
  };
})();
