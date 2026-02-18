# User-Driven Account Creation Tool - Implementation TODO

## Purpose
Create a user-friendly account creation interface that integrates with the M Console authorization system, enabling players to:
- Register new accounts with email/username
- Connect AI agent APIs for gameplay automation
- Persist inventory, currency, and save state data across sessions
- Merge data from multiple sources (local, cloud, agent runs)

---

## 0) Architecture Overview

### Components
1. **Frontend UI** - Account creation form in main terminal interface
2. **M Console Integration** - Authorization code generation and validation
3. **Local Storage Bridge** - Merge existing local data with new accounts
4. **Agent API Manager** - Store and validate agent credentials
5. **Save State Synchronization** - Cloud sync for cross-device play

### Data Flow
```
User Registration → M Console Auth Code → Account Creation →
Local Data Merge → Agent API Binding → Cloud Sync Enable
```

---

## 1) Frontend Account Creation UI

### 1.1 Registration Form Location
Create new form overlay triggered by:
- Command: `register` or `create account`
- Button: Add "Register" option to login screen
- First-time user prompt after initial terminal interaction

### 1.2 Form Fields
Required:
- **Username** - 3-20 alphanumeric characters, unique
- **Email** - Valid email format, used for recovery
- **Password** - 8+ characters, one uppercase, one number
- **Auth Code** - 6-digit code from M Console (see section 2)

Optional:
- **Callsign** - Player nickname for leaderboards (defaults to username)
- **Agent API Key** - Connect AI agent immediately (can be added later)
- **Agent API URL** - Custom endpoint for agent communication

### 1.3 Validation Rules
- [ ] Check username availability (local + server check)
- [ ] Validate email format with regex
- [ ] Password strength meter (weak/medium/strong)
- [ ] Auth code verification via M Console API
- [ ] Rate limiting: Max 3 registration attempts per IP per hour

### 1.4 UI Mockup Structure
```
┌──────────────────────────────────────────────┐
│  EYES ONLY - ACCOUNT REGISTRATION            │
│  ──────────────────────────────────────────  │
│                                               │
│  Username: [________________]  Check ✓       │
│  Email:    [________________]                │
│  Password: [________________] [👁]           │
│  Confirm:  [________________] [👁]           │
│                                               │
│  M Console Auth Code: [______]  Verify       │
│  → Visit /m to generate code                 │
│                                               │
│  [Optional] Agent Integration:                │
│  API Key:  [________________]  Skip          │
│  API URL:  [________________]                │
│                                               │
│  [ ] I agree to Terms of Service             │
│                                               │
│  [Cancel]              [Create Account]       │
└──────────────────────────────────────────────┘
```

---

## 2) M Console Authorization Integration

### 2.1 Auth Code Generation Flow
1. User navigates to `/m` (M Console interface)
2. User clicks "Generate Registration Code"
3. System generates 6-digit code (e.g., `741829`)
4. Code is valid for 15 minutes
5. Code is single-use only
6. Display code with countdown timer

### 2.2 Code Verification API
Endpoint: `POST /api/auth/verify-code`

Request:
```json
{
  "code": "741829",
  "username": "player_name",
  "email": "player@example.com"
}
```

Response (Success):
```json
{
  "valid": true,
  "user_id": "uuid-here",
  "token": "jwt-token-here",
  "expires_at": "2026-02-19T01:00:00Z"
}
```

Response (Invalid):
```json
{
  "valid": false,
  "error": "code_expired" | "code_invalid" | "code_already_used"
}
```

### 2.3 M Console UI Component
- [ ] Add "Registration Codes" section to `/m`
- [ ] Show active codes (if any) with expiry countdown
- [ ] Button: "Generate New Code"
- [ ] Display code in large, copyable format
- [ ] Show registration instructions
- [ ] Track code usage (used/expired/active)

---

## 3) Account Data Structure

### 3.1 User Account Schema
```typescript
interface UserAccount {
  user_id: string;              // UUID
  username: string;             // Unique, 3-20 chars
  email: string;                // For recovery
  callsign: string;             // Display name
  password_hash: string;        // Bcrypt hashed
  created_at: string;           // ISO timestamp
  last_login: string;           // ISO timestamp

  // Game state
  inventory_persistent: Item[]; // Survives death
  inventory_loose: Item[];      // Lost on death
  cryptos: number;              // Currency

  // Agent integration
  agent_api_key?: string;       // Encrypted
  agent_api_url?: string;       // Custom endpoint
  agent_enabled: boolean;       // Toggle

  // Highscores
  highscores: {
    gone_rogue: HighscoreEntry[];
    street_chronicles: HighscoreEntry[];
    eyesonly_live: HighscoreEntry[];
  };

  // Metadata
  total_playtime: number;       // Seconds
  achievements: string[];       // Achievement IDs
  preferences: UserPreferences;
}

interface UserPreferences {
  theme: 'green' | 'amber' | 'blue';
  sfx_enabled: boolean;
  tutorial_completed: boolean;
  cloud_sync_enabled: boolean;
}
```

### 3.2 Local Storage Migration
When user creates account, migrate existing local data:

```javascript
function migrateLocalData(userId) {
  // Read existing localStorage keys
  var rogueState = localStorage.getItem('eyesonly_rogue_state');
  var streetState = localStorage.getItem('eyesonly_street_state');
  var gameState = localStorage.getItem('eyesonly_gamestate');

  // Parse and merge with new account
  var account = {
    inventory_persistent: parseGameState(gameState).inventoryPersistent,
    inventory_loose: parseGameState(gameState).inventoryLoose,
    cryptos: parseGameState(gameState).cryptos,
    // ... merge other fields
  };

  // Upload to cloud
  uploadAccountData(userId, account);

  // Keep local copy
  localStorage.setItem('eyesonly_user_account', JSON.stringify(account));
}
```

---

## 4) Agent API Management

### 4.1 Agent Credential Storage
Store agent credentials securely:
- [ ] Encrypt API keys before storing (AES-256)
- [ ] Never log or expose keys in client-side code
- [ ] Store encryption key in secure cookie (HttpOnly)
- [ ] Allow user to view/rotate keys in settings

### 4.2 Agent Connection Flow
1. User enters API key + URL during registration (or later in settings)
2. System validates endpoint with test request:
   ```
   GET {agent_api_url}/health
   Authorization: Bearer {api_key}
   ```
3. If valid, store credentials and mark `agent_enabled: true`
4. Agent can now be invoked via Kernel button
5. Agent responses appear in MOK interjection field

### 4.3 Agent Runner Interface
Define standard interface for AI agents:

```typescript
interface AgentRunner {
  // Metadata
  id: string;
  displayName: string;
  version: string;

  // Game control
  takeControl(game: 'gone_rogue' | 'street_chronicles' | 'eyesonly_live'): Promise<void>;
  releaseControl(): Promise<void>;

  // Action execution
  executeAction(action: GameAction): Promise<ActionResult>;

  // Observation
  getState(): Promise<GameState>;

  // Audit
  getTrace(): ActionTrace[];
}

interface GameAction {
  type: 'move' | 'attack' | 'use_item' | 'interact';
  direction?: 'north' | 'south' | 'east' | 'west';
  target?: {x: number, y: number};
  itemId?: string;
}
```

### 4.4 OpenClaw Compatibility
Support OpenClaw-style API calls:
- [ ] Document OpenClaw adapter format
- [ ] Provide example OpenClaw configuration
- [ ] Test with sample OpenClaw agent
- [ ] Add OpenClaw-specific error handling

---

## 5) Save State Synchronization

### 5.1 Cloud Sync Strategy
- **Push on events:**
  - User logs out
  - Game completion (extraction/death)
  - Every 5 minutes during active play
  - Manual "Save to Cloud" button

- **Pull on events:**
  - User logs in
  - Page refresh
  - Device change

### 5.2 Conflict Resolution
When local and cloud data differ:

```javascript
function resolveConflict(localData, cloudData) {
  // Use timestamp to determine newer data
  if (localData.last_modified > cloudData.last_modified) {
    // Local is newer - upload
    return 'upload';
  } else if (cloudData.last_modified > localData.last_modified) {
    // Cloud is newer - download
    return 'download';
  } else {
    // Same timestamp - merge
    return mergeCurrency(localData, cloudData);
  }
}

function mergeCurrency(local, cloud) {
  // Take maximum currency (never lose money)
  return {
    cryptos: Math.max(local.cryptos, cloud.cryptos),
    // Merge inventories (union)
    inventory: unionInventories(local.inventory, cloud.inventory),
    // Take best highscores
    highscores: mergeBestScores(local.highscores, cloud.highscores)
  };
}
```

### 5.3 Offline Support
- [ ] Queue actions when offline
- [ ] Sync when connection restored
- [ ] Show sync status indicator in UI
- [ ] Handle sync failures gracefully

---

## 6) Integration Points

### 6.1 Login Shell Integration
File: `public/js/login-shell.js`

Add account creation flow:
```javascript
// After successful auth code verification
function onAccountCreated(userData) {
  // Enable kernel button
  if (typeof UIControls !== 'undefined') {
    UIControls.enableKernelButton();
  }

  // Initialize highscore tracking
  if (typeof HighscoreState !== 'undefined') {
    HighscoreState.setUserId(userData.user_id);
  }

  // Load user inventory into GAMESTATE
  if (typeof GAMESTATE !== 'undefined') {
    GAMESTATE.loadUserData(userData);
  }
}
```

### 6.2 Highscore Submission Hook
File: `public/js/highscore-state.js`

Require authentication for submissions:
```javascript
function submitHighscore(entry) {
  // Check if user is logged in
  var userId = getCurrentUserId();
  if (!userId) {
    return {
      success: false,
      error: 'login_required',
      message: 'Please login to submit scores'
    };
  }

  // Add user_id to entry
  entry.user_id = userId;
  entry.display_name = getUserCallsign();

  // Submit to cloud + local
  return submitToCloudAndLocal(entry);
}
```

### 6.3 Gone Rogue Integration
File: `public/js/gone-rogue.js`

Submit score on extraction:
```javascript
function _exitRogue(extracted) {
  // Calculate score
  var runData = {
    currencyFound: _currencies.length,
    interactivesFound: InteractiveItems.getInteractionCount(),
    enemiesAvoided: calculateEnemiesAvoided(),
    breakableDamage: calculateBreakableDamage(),
    damageMitigated: _player.damageMitigated
  };

  var score = HighscoreState.calculateGoneRogueScore(runData);

  // Submit if user is logged in
  if (isUserLoggedIn()) {
    HighscoreState.submitHighscore({
      game_id: 'gone_rogue',
      mode: isAgentActive() ? 'agent' : 'human',
      score: score,
      metadata: {
        completions: extracted ? 1 : 0,
        player_deaths: extracted ? 0 : 1,
        most_damage_dealt_single_action: _maxDamageDealt,
        // ... other stats
      }
    });
  }
}
```

---

## 7) Security Considerations

### 7.1 Authentication
- [ ] Use JWT tokens with 7-day expiry
- [ ] Refresh token mechanism
- [ ] Secure session storage
- [ ] CSRF protection on all POST requests

### 7.2 API Key Protection
- [ ] Never send API keys in URLs
- [ ] Always use HTTPS
- [ ] Encrypt keys at rest
- [ ] Rate limit agent API calls (10 req/sec)

### 7.3 Data Validation
- [ ] Server-side validation of all inputs
- [ ] Sanitize user-generated content
- [ ] Prevent SQL injection in queries
- [ ] XSS protection on displayed data

---

## 8) Testing Checklist

### 8.1 Unit Tests
- [ ] Username validation (length, characters, uniqueness)
- [ ] Email format validation
- [ ] Password strength checking
- [ ] Auth code generation and expiry
- [ ] Data migration from local storage
- [ ] Conflict resolution algorithms

### 8.2 Integration Tests
- [ ] Full registration flow (form → code → account)
- [ ] Login with new account
- [ ] Load existing save data
- [ ] Submit highscore as authenticated user
- [ ] Agent API connection and control
- [ ] Cloud sync push/pull

### 8.3 E2E Tests
- [ ] New user creates account
- [ ] Existing user logs in on new device
- [ ] Agent takes control of Gone Rogue
- [ ] Score appears on leaderboard
- [ ] Data persists across sessions

---

## 9) Error Handling

### 9.1 User-Facing Errors
```javascript
var ERROR_MESSAGES = {
  'username_taken': 'Username already exists. Please choose another.',
  'email_invalid': 'Please enter a valid email address.',
  'password_weak': 'Password must be at least 8 characters with 1 uppercase and 1 number.',
  'code_expired': 'Authorization code expired. Generate a new code from /m.',
  'code_invalid': 'Invalid authorization code. Please check and try again.',
  'network_error': 'Connection failed. Check your internet and try again.',
  'agent_unreachable': 'Cannot connect to agent API. Check URL and key.',
  'sync_conflict': 'Data conflict detected. Please choose which version to keep.'
};
```

### 9.2 Recovery Flows
- [ ] "Forgot Password" via email
- [ ] "Resend Auth Code" button
- [ ] "Skip Agent Setup" for later
- [ ] "Merge Data Manually" conflict resolver
- [ ] "Contact Support" fallback

---

## 10) UI/UX Requirements

### 10.1 Accessibility
- [ ] Keyboard navigation for all form fields
- [ ] Screen reader labels for inputs
- [ ] High contrast mode support
- [ ] Clear error messages with ARIA alerts

### 10.2 Visual Design
- [ ] Match existing CRT terminal aesthetic
- [ ] Green phosphor color scheme (or theme variants)
- [ ] Loading spinners for async operations
- [ ] Success/error animations
- [ ] Progress indicators for multi-step flows

### 10.3 Mobile Responsiveness
- [ ] Touch-friendly form inputs
- [ ] Virtual keyboard doesn't obscure form
- [ ] Swipe-to-dismiss error messages
- [ ] Responsive layout for small screens

---

## 11) Deployment Checklist

### 11.1 Backend API
- [ ] Deploy account creation endpoint
- [ ] Set up database tables (users, auth_codes)
- [ ] Configure email service for recovery
- [ ] Enable HTTPS with SSL certificate
- [ ] Set up rate limiting rules

### 11.2 Frontend Integration
- [ ] Add registration form to main site
- [ ] Wire up M Console auth code UI
- [ ] Connect to backend API endpoints
- [ ] Test on staging environment
- [ ] Deploy to production

### 11.3 Documentation
- [ ] User guide: "How to Create an Account"
- [ ] Developer docs: API endpoints and schemas
- [ ] Agent integration guide: OpenClaw setup
- [ ] Troubleshooting FAQ

---

## 12) Open Questions / Future Enhancements

- **Social Features:** Friend lists, team leaderboards?
- **2FA:** Add two-factor authentication for security?
- **OAuth:** Allow login with Google/GitHub/Discord?
- **Agent Marketplace:** Browse and install community agents?
- **Replay System:** Save and share agent run replays?
- **Account Linking:** Merge multiple accounts?

---

## 13) Success Metrics

Track the following post-launch:
- [ ] Account creation conversion rate
- [ ] Time to complete registration (target: < 2 min)
- [ ] Auth code success rate (target: > 95%)
- [ ] Cloud sync reliability (target: > 99%)
- [ ] Agent API connection rate (target: > 80%)
- [ ] User retention after 7 days (target: > 40%)

---

## 14) Implementation Timeline Estimate

**Phase 1: Core Registration (Week 1)**
- UI form + validation
- M Console auth code generation
- Basic account creation API

**Phase 2: Data Migration (Week 2)**
- Local storage merger
- Cloud sync infrastructure
- Conflict resolution

**Phase 3: Agent Integration (Week 3)**
- Agent credential management
- API connection flow
- Kernel button activation

**Phase 4: Testing & Polish (Week 4)**
- E2E testing
- Bug fixes
- Documentation
- Soft launch

**Total Estimated Time:** 4 weeks (1 FTE developer)

---

## 15) Notes for Engineers

- Use existing `LoginShell` module as reference for auth flows
- Follow IIFE pattern used throughout codebase (no frameworks)
- Maintain CRT aesthetic consistency with `crt.css`
- localStorage keys should follow `eyesonly_*` naming convention
- All user-facing text should match existing terminal voice/tone
- Test with actual OpenClaw agent before claiming compatibility
- Don't forget to handle the "user closes tab mid-registration" edge case

---

**END OF TODO DOCUMENT**

Questions? Contact: admin@stellaraqua.com
