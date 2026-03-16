/* ============================================================
   EYES ONLY - Kernel Manager (External Agent Decision API)

   - Connect external agent by URL only (easier than OpenClaw setup)
   - Maintain Kernel button state vocabulary
   - Provide terminal commands: KERNEL CONNECT/STATUS/RUN/DISCONNECT
   ============================================================ */

const KernelManager = (function () {
  'use strict';

  const STORAGE_KEY = 'eyesonly_kernel_state';

  const STATES = {
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    ACTIVE_RUN: 'ACTIVE_RUN',
    DISMISSING: 'DISMISSING',
    ERROR: 'ERROR'
  };

  let _state = STATES.DISCONNECTED;
  let _agentUrl = null;
  let _agentName = null;
  let _agentVersion = null;
  let _lastError = null;

  function init() {
    _load();
    // If logged in, attempt to restore persisted kernel state from server
    if (isAuthenticated()) {
      syncFromServer();
    }
    _syncButton();
  }

  function isAuthenticated() {
    return (typeof UserAccount !== 'undefined') && UserAccount.isLoggedIn && UserAccount.isLoggedIn();
  }

  function isKernelCommand(raw) {
    const n = Parser && Parser.normalize ? Parser.normalize(raw || '') : (raw || '').trim().toLowerCase();
    return n === 'kernel' || n.startsWith('kernel ');
  }

  function getState() {
    return {
      state: _state,
      agentUrl: _agentUrl,
      agentName: _agentName,
      agentVersion: _agentVersion,
      lastError: _lastError
    };
  }

  function showInterface() {
    if (!isAuthenticated()) {
      return {
        lines: [
          '',
          'KERNEL ACCESS DENIED',
          '————————————————————————————————',
          '',
          '[SYSTEM]: Authentication required.',
          '[SYSTEM]: Please login to access agent integration.',
          ''
        ],
        stayActive: true,
        prompt: 'COMMAND> '
      };
    }

    const s = getState();

    if (s.state === STATES.DISCONNECTED || s.state === STATES.ERROR) {
      const extra = s.lastError ? ['ERROR: ' + s.lastError, ''] : [''];
      return {
        lines: [
          '',
          'KERNEL AGENT INTEGRATION',
          '————————————————————————————————',
          '',
          'STATE: DISCONNECTED',
          '',
          'CONNECT AN EXTERNAL AGENT (URL ONLY):',
          '  KERNEL CONNECT https://your-agent-host.com',
          '',
          'OTHER COMMANDS:',
          '  KERNEL STATUS',
          '  KERNEL HELP',
          ''
        ].concat(extra),
        stayActive: true,
        prompt: 'COMMAND> '
      };
    }

    if (s.state === STATES.CONNECTING) {
      return {
        lines: [
          '',
          'KERNEL AGENT INTEGRATION',
          '————————————————————————————————',
          '',
          'STATE: CONNECTING…',
          'AGENT URL: ' + (s.agentUrl || '[none]'),
          ''
        ],
        stayActive: true,
        prompt: 'COMMAND> '
      };
    }

    // CONNECTED / ACTIVE_RUN / DISMISSING
    return {
      lines: [
        '',
        'KERNEL AGENT INTEGRATION',
        '————————————————————————————————',
        '',
        'STATE: ' + s.state,
        'AGENT: ' + (s.agentName || '[unknown]') + (s.agentVersion ? (' v' + s.agentVersion) : ''),
        'URL: ' + (s.agentUrl || '[none]'),
        '',
        'ACTIONS:',
        '  KERNEL RUN',
        '  KERNEL DISCONNECT',
        '  KERNEL STATUS',
        ''
      ],
      stayActive: true,
      prompt: 'COMMAND> '
    };
  }

  async function connect(agentUrl) {
    if (!isAuthenticated()) {
      _setError('login required');
      return;
    }

    if (!agentUrl || typeof agentUrl !== 'string') {
      _setError('agent_url required');
      return;
    }

    const url = agentUrl.replace(/\/$/, '');

    _state = STATES.CONNECTING;
    _agentUrl = url;
    _agentName = null;
    _agentVersion = null;
    _lastError = null;
    _save();
    _syncButton();

    // Handshake via /health
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url + '/health', { method: 'GET', signal: controller.signal });
      clearTimeout(t);

      if (!res.ok) {
        throw new Error('health check failed (' + res.status + ')');
      }

      const data = await res.json().catch(() => ({}));
      _agentName = (data && data.agent_name) ? String(data.agent_name) : 'Agent';
      _agentVersion = (data && data.agent_version) ? String(data.agent_version) : null;

      _state = STATES.CONNECTED;
      _lastError = null;
      _save();
      _syncButton();

      // Persist server-side (best-effort)
      persistConnect();

      Terminal.writeLine('');
      Terminal.writeLine('KERNEL CONNECTED: ' + _agentName, 'success-msg');
      Terminal.writeLine('');
    } catch (e) {
      _setError(e && e.message ? e.message : 'connect failed');
      Terminal.writeLine('');
      Terminal.writeLine('KERNEL CONNECT FAILED: ' + _lastError, 'error-msg');
      Terminal.writeLine('');
    }
  }

  async function run() {
    if (_state !== STATES.CONNECTED) {
      _setError('not connected');
      Terminal.writeLine('');
      Terminal.writeLine('KERNEL RUN DENIED: not connected', 'error-msg');
      Terminal.writeLine('');
      return;
    }

    if (typeof GoneRogue === 'undefined' || !GoneRogue.isActive || !GoneRogue.isActive()) {
      _setError('must be in Gone Rogue mode');
      Terminal.writeLine('');
      Terminal.writeLine('KERNEL RUN DENIED: enter Gone Rogue first (type: rogue)', 'error-msg');
      Terminal.writeLine('');
      return;
    }

    if (typeof AgentIntegration === 'undefined' || !AgentIntegration.startKernelDecisionTakeover) {
      _setError('agent integration not available');
      Terminal.writeLine('');
      Terminal.writeLine('KERNEL RUN FAILED: AgentIntegration kernel mode not available', 'error-msg');
      Terminal.writeLine('');
      return;
    }

    _state = STATES.ACTIVE_RUN;
    _lastError = null;
    _save();
    _syncButton();

    const started = AgentIntegration.startKernelDecisionTakeover({
      agentUrl: _agentUrl,
      agentName: _agentName
    });

    if (!started) {
      _setError('failed to start run');
      Terminal.writeLine('');
      Terminal.writeLine('KERNEL RUN FAILED', 'error-msg');
      Terminal.writeLine('');
      return;
    }

    Terminal.writeLine('');
    Terminal.writeLine('KERNEL RUN STARTED (' + (_agentName || 'Agent') + ')', 'system-msg');
    Terminal.writeLine('Type AGENT STOP to release control, or KERNEL DISCONNECT to detach agent.', 'system-msg');
    Terminal.writeLine('');
  }

  function disconnect() {
    if (_state === STATES.DISCONNECTED) return;

    _state = STATES.DISMISSING;
    _save();
    _syncButton();

    // Stop any active takeover
    try {
      if (typeof AgentIntegration !== 'undefined' && AgentIntegration.isActive && AgentIntegration.isActive()) {
        AgentIntegration.stopAgentTakeover();
      }
    } catch (e) { /* ignore */ }

    _state = STATES.DISCONNECTED;
    _agentUrl = null;
    _agentName = null;
    _agentVersion = null;
    _lastError = null;
    _save();
    _syncButton();

    // Persist disconnection to server (best-effort)
    persistDisconnect();

    Terminal.writeLine('');
    Terminal.writeLine('KERNEL DISCONNECTED', 'system-msg');
    Terminal.writeLine('');
  }

  function process(raw) {
    const normalized = Parser.normalize(raw || '');
    const parts = normalized.split(' ').filter(Boolean);

    // "kernel" alone
    if (parts.length === 1) {
      return showInterface();
    }

    const sub = parts[1] || '';

    if (sub === 'help') {
      return showInterface();
    }

    if (sub === 'status') {
      const s = getState();
      return {
        lines: [
          '',
          'KERNEL STATUS',
          '————————————————————————————————',
          '',
          'STATE: ' + s.state,
          'AGENT: ' + (s.agentName || '[none]'),
          'URL: ' + (s.agentUrl || '[none]'),
          (s.lastError ? ('ERROR: ' + s.lastError) : ''),
          ''
        ],
        stayActive: true,
        prompt: 'COMMAND> '
      };
    }

    if (sub === 'connect') {
      // Use RAW input to preserve URL punctuation (Parser.normalize strips ':' and '.')
      const rawParts = String(raw || '').trim().split(/\s+/);
      const rawUrl = rawParts.slice(2).join(' ').trim();

      // async side-effect; immediate response
      connect(rawUrl);
      return {
        lines: [
          '',
          'KERNEL CONNECT',
          '————————————————————————————————',
          '',
          'CONNECTING…',
          'URL: ' + (rawUrl || '[missing]'),
          ''
        ],
        stayActive: true,
        prompt: 'COMMAND> '
      };
    }

    if (sub === 'run') {
      run();
      return {
        lines: [
          '',
          'KERNEL RUN',
          '————————————————————————————————',
          '',
          'REQUEST SUBMITTED',
          ''
        ],
        stayActive: true,
        prompt: 'COMMAND> '
      };
    }

    if (sub === 'disconnect') {
      disconnect();
      return {
        lines: [
          '',
          'KERNEL DISCONNECT',
          '————————————————————————————————',
          '',
          'DISMISSING…',
          ''
        ],
        stayActive: true,
        prompt: 'COMMAND> '
      };
    }

    return {
      lines: [
        '',
        'KERNEL: UNKNOWN SUBCOMMAND',
        'TRY: KERNEL HELP | KERNEL STATUS | KERNEL CONNECT <url> | KERNEL RUN | KERNEL DISCONNECT',
        ''
      ],
      stayActive: true,
      prompt: 'COMMAND> '
    };
  }

  function _setError(msg) {
    _state = STATES.ERROR;
    _lastError = String(msg || 'error');
    _save();
    _syncButton();
  }

  /** Set both textContent and data-text for CSS ::after rendering (FIG 3) */
  function _setBtnLabel(btn, label) {
    btn.textContent = label;
    btn.setAttribute('data-text', label.toUpperCase());
  }

  function _syncButton() {
    const btn = document.querySelector('button[data-action="kernel"]');
    if (!btn) return;

    if (!isAuthenticated()) {
      btn.disabled = true;
      _setBtnLabel(btn, 'kernel');
      btn.classList.remove('enabled');
      btn.classList.remove('connected');
      btn.classList.remove('active-run');
      return;
      _syncMOKToKernelButton();
    }

    btn.disabled = false;
    btn.classList.add('enabled');

    if (_state === STATES.CONNECTING) {
      _setBtnLabel(btn, 'connecting...');
      btn.classList.remove('connected');
      btn.classList.remove('active-run');
      _syncMOKToKernelButton();
      return;
    }

    if (_state === STATES.CONNECTED) {
      const name = (_agentName || 'agent').slice(0, 12);
      _setBtnLabel(btn, 'connected: ' + name);
      btn.classList.add('connected');
      btn.classList.remove('active-run');
      _syncMOKToKernelButton();
      return;
    }

    if (_state === STATES.ACTIVE_RUN) {
      const name = (_agentName || 'agent').slice(0, 12);
      _setBtnLabel(btn, name);
      btn.classList.add('connected');
      btn.classList.add('active-run');
      _syncMOKToKernelButton();
      return;
    }

    if (_state === STATES.DISMISSING) {
      _setBtnLabel(btn, 'dismissing...');
      _syncMOKToKernelButton();
      btn.classList.remove('active-run');
      return;
    }

    // DISCONNECTED / ERROR
    _syncMOKToKernelButton();
    _setBtnLabel(btn, 'kernel');
    btn.classList.remove('connected');
    btn.classList.remove('active-run');
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        state: _state,
        agentUrl: _agentUrl,
        agentName: _agentName,
        agentVersion: _agentVersion,
        lastError: _lastError
      }));
    } catch (e) { /* ignore */ }
  }

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      _state = data.state || STATES.DISCONNECTED;
      _agentUrl = data.agentUrl || null;
      _agentName = data.agentName || null;
      _agentVersion = data.agentVersion || null;
      _lastError = data.lastError || null;
    } catch (e) {
      // ignore
    }
  }

  async function persistConnect() {
    if (!isAuthenticated()) return;

    const token = UserAccount.getSessionToken();
    if (!token) return;

    try {
      const res = await fetch('/api/kernel/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        body: JSON.stringify({
          agent_url: _agentUrl,
          agent_name: _agentName
        })
      });

      if (!res.ok) {
        console.warn('Failed to persist kernel connection to server');
      }
    } catch (e) {
      console.warn('Failed to persist kernel connection:', e);
    }
  }

  async function persistDisconnect() {
    if (!isAuthenticated()) return;

    const token = UserAccount.getSessionToken();
    if (!token) return;

    try {
      const res = await fetch('/api/kernel/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        }
      });

      if (!res.ok) {
        console.warn('Failed to persist kernel disconnection to server');
      }
    } catch (e) {
      console.warn('Failed to persist kernel disconnection:', e);
    }
  }

  async function syncFromServer() {
    if (!isAuthenticated()) return;

    const token = UserAccount.getSessionToken();
    if (!token) return;

    try {
      const res = await fetch('/api/kernel/me', {
        method: 'GET',
        headers: {
          'X-Session-Token': token
        }
      });

      if (!res.ok) return;

      const data = await res.json();
      const kernel = data && data.kernel;

      if (!kernel) return;

      if (kernel.status === 'CONNECTED' || kernel.status === 'ACTIVE_RUN') {
        if (kernel.agent) {
          _agentUrl = kernel.agent.url;
          _agentName = kernel.agent.name || 'Agent';
          _agentVersion = null;
          _state = kernel.status;
          _lastError = kernel.last_error || null;
          _save();
          _syncButton();
        }
      } else if (kernel.status === 'DISCONNECTED') {
        // Server says disconnected, clear local state if it differs
        if (_state !== STATES.DISCONNECTED) {
          _state = STATES.DISCONNECTED;
          _agentUrl = null;
          _agentName = null;
          _agentVersion = null;
          _lastError = null;
          _save();
          _syncButton();
        }
      }
    } catch (e) {
      console.warn('Failed to sync kernel state from server:', e);
    }
  }

  /**
   * Sync MOK triangle color to kernel button status color
   */
  function _syncMOKToKernelButton() {
    // Check if MOK visual engine is available
    if (typeof MOKVisualEngine === 'undefined' || !MOKVisualEngine.setCustomGlowColors) {
      return;
    }

    const btn = document.querySelector('button[data-action="kernel"]');
    if (!btn) return;

    // Map kernel state to MOK colors
    let primaryColor = null;
    let secondaryColor = null;
    let pulseSpeed = null;

    if (_state === STATES.CONNECTED) {
      // Connected: Use green tones
      primaryColor = '#00FF88';  // Bright green
      secondaryColor = '#00CC66'; // Mid green
      pulseSpeed = 3000;
    } else if (_state === STATES.ACTIVE_RUN) {
      // Active run: Bright cyan/green
      primaryColor = '#00FFCC';  // Cyan-green
      secondaryColor = '#00FFAA'; // Bright green
      pulseSpeed = 1000;  // Faster pulse
    } else if (_state === STATES.ERROR) {
      // Error: Red tones
      primaryColor = '#FF4444';
      secondaryColor = '#CC0000';
      pulseSpeed = 500;  // Rapid pulse
    } else if (_state === STATES.CONNECTING) {
      // Connecting: Yellow/orange
      primaryColor = '#FFCC00';
      secondaryColor = '#FF8800';
      pulseSpeed = 2000;
    } else {
      // Disconnected: Use default (don't override)
      return;
    }

    // Apply colors to MOK
    MOKVisualEngine.setCustomGlowColors(primaryColor, secondaryColor, pulseSpeed);
  }

  /**
   * Get kernel button color (for external use)
   */
  function getKernelButtonColor() {
    const btn = document.querySelector('button[data-action="kernel"]');
    if (!btn) return null;

    const computedStyle = window.getComputedStyle(btn);
    return {
      color: computedStyle.color,
      backgroundColor: computedStyle.backgroundColor,
      state: _state
    };
  }

  return {
    STATES,
    init,
    isKernelCommand,
    process,
    showInterface,
    getState,
    connect,
    disconnect,
    run,
    syncButton: _syncButton,
    getKernelButtonColor: getKernelButtonColor
  };
})();

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    KernelManager.init();
  });
} else {
  KernelManager.init();
}
