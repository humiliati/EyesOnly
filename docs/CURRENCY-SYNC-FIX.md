# Currency & Inventory Sync Fix Plan

> **Status:** Planning — March 18, 2026
> **Priority:** HIGH — currency is being lost silently
> **Scope:** Server API + client sync + constellation rewards wiring

---

## The Bug

Currency earned during gameplay (constellation rewards, loot pickups, puzzle completion) only persists in localStorage. The server receives a ONE-TIME merge on first login per device, then never again. Subsequent earnings are permanently lost on browser close, device switch, or storage clear.

### Evidence

1. `GAMESTATE.addCryptos()` writes only to localStorage via `_saveState()`
2. `/api/user/merge-local-data` checks `device_id` and returns `already_merged: true` on repeat logins
3. `constellation-rewards.js` dispatches `currency-increment` events with no consumer that writes to storage
4. No `POST /api/user/cryptos` endpoint exists for real-time sync

---

## Fix 1: Add Server-Side Currency Sync Endpoint

### New endpoint: `POST /api/user/cryptos`

```typescript
// In src/worker/routes/user-auth.ts
userAuthRoutes.post('/cryptos', requireUserAuth, async (c) => {
  const body = await c.req.json<{ delta: number; reason: string }>();
  const userId = c.get('userAuth').user_id;

  if (!body.delta || typeof body.delta !== 'number') {
    return c.json({ error: 'delta required' }, 400);
  }

  // Apply delta (can be positive or negative)
  await updateUserCryptos(c.env.DB, userId, body.delta);
  const newBalance = await getUserCryptos(c.env.DB, userId);

  return c.json({ cryptos: newBalance });
});
```

### Client-side sync in GAMESTATE

```javascript
// In gamestate.js — add to addCryptos() and spendCryptos()
function _syncCryptosToServer(delta, reason) {
  if (typeof UserAccount === 'undefined' || !UserAccount.isLoggedIn()) return;
  var token = UserAccount.getSessionToken();
  if (!token) return;

  // Fire-and-forget — don't block gameplay
  fetch('/api/user/cryptos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
    body: JSON.stringify({ delta: delta, reason: reason })
  }).catch(function() { /* offline — localStorage has the truth */ });
}
```

Call `_syncCryptosToServer(amount, 'constellation')` from `addCryptos()` and `_syncCryptosToServer(-amount, 'purchase')` from `spendCryptos()`.

---

## Fix 2: Wire Constellation Rewards to GAMESTATE

### Current state
`constellation-rewards.js` dispatches `currency-increment` and `currency-settle` CustomEvents. Nothing consumes them for persistence.

### Fix
In `constellation-rewards.js`, after calculating the yield and before dispatching the event, call GAMESTATE directly:

```javascript
// After calculating coinYield
if (typeof GAMESTATE !== 'undefined' && GAMESTATE.addCryptos) {
  GAMESTATE.addCryptos(coinYield);
} else {
  // Fallback: store in AccountInventory or localStorage directly
  try {
    var acct = JSON.parse(localStorage.getItem('eyesonly_account') || '{}');
    acct.puzzleCoins = (acct.puzzleCoins || 0) + coinYield;
    localStorage.setItem('eyesonly_account', JSON.stringify(acct));
  } catch (_) {}
}
```

**Note:** On /booking and /games pages, GAMESTATE is not loaded (it's part of the Gone Rogue lazy bundle). The fallback writes to `eyesonly_account.puzzleCoins` which is the non-gamestate coin store used by puzzle rewards. These should be reconciled.

### Better approach: Move constellation coin writes to AccountInventory

Since AccountInventory is loaded sync on all pages, use it as the cross-page currency bridge:

```javascript
// In constellation-rewards.js
if (typeof AccountInventory !== 'undefined') {
  AccountInventory.addCurrency(coinYield);
}
```

Then sync AccountInventory to server on login (already partially implemented).

---

## Fix 3: Remove One-Shot Merge Restriction

### Current behavior
`/api/user/merge-local-data` in user-auth.ts line 397-398 checks if `device_id` has already been merged and returns early.

### Fix
Remove the idempotency check, or change it to always re-merge currency (while keeping inventory idempotent to avoid duplicates):

```typescript
// Replace the early return with a currency-only re-merge
if (existingMerge) {
  // Already merged this device — still sync currency
  const localCryptos = body.gamestate?.cryptos || 0;
  if (localCryptos > 0) {
    const cur = await getUserCryptos(c.env.DB, session.user_id) || 0;
    if (localCryptos > cur) {
      await updateUserCryptos(c.env.DB, session.user_id, localCryptos - cur);
    }
  }
  return c.json({ ok: true, already_merged: true, currency_synced: true });
}
```

---

## Fix 4: Load Server Balance on Login

### Current behavior
`/api/user/login` returns the user's server-side `cryptos` balance, but the client ignores it.

### Fix
In `login-ui.js` `_notifyLoginSuccess()`, after login succeeds, fetch `/api/user/me` and update the local gamestate:

```javascript
// After successful login, pull server balance
UserAccount.fetchMe().then(function(data) {
  if (data && data.user && typeof data.user.cryptos === 'number') {
    // Update GAMESTATE if loaded
    if (typeof GAMESTATE !== 'undefined' && GAMESTATE.loadUserData) {
      GAMESTATE.loadUserData(data.user);
    }
    // Update header display
    if (typeof UIControls !== 'undefined' && UIControls.updateCurrencyDisplay) {
      UIControls.updateCurrencyDisplay(data.user.cryptos);
    }
  }
});
```

---

## Fix 5: Reconcile Currency Stores

Currently there are THREE places currency lives:

| Store | Location | Used by |
|-------|----------|---------|
| `GAMESTATE.cryptos` | localStorage `eyesonly_gamestate` | Gone Rogue gameplay |
| `eyesonly_account.puzzleCoins` | localStorage `eyesonly_account` | Puzzle rewards, QR puzzle onSolve |
| `user_accounts.cryptos` | D1 database | Server truth |

### Reconciliation
Choose ONE client-side truth: GAMESTATE for logged-in users, `eyesonly_account.puzzleCoins` for anonymous users. On login, merge both into server:

```javascript
function mergeAllCurrency() {
  var gamestateCryptos = 0;
  var puzzleCoins = 0;

  try {
    var gs = JSON.parse(localStorage.getItem('eyesonly_gamestate') || '{}');
    gamestateCryptos = gs.cryptos || 0;
  } catch (_) {}

  try {
    var acct = JSON.parse(localStorage.getItem('eyesonly_account') || '{}');
    puzzleCoins = acct.puzzleCoins || 0;
  } catch (_) {}

  return gamestateCryptos + puzzleCoins;
}
```

Send this total during merge-local-data.

---

## Implementation Order

1. **Add `POST /api/user/cryptos`** — server endpoint (user-auth.ts)
2. **Wire GAMESTATE.addCryptos/spendCryptos** to call the new endpoint
3. **Wire constellation-rewards** to write to GAMESTATE or AccountInventory
4. **Remove one-shot merge restriction** for currency (keep it for inventory)
5. **Pull server balance on login** and update client state
6. **Reconcile the three currency stores** into one flow

---

## UNIFIED_INVENTORY_METADATA_CONTRACT Staleness Check

The contract document is still valid for item schema, but needs updates for:

1. **Currency as inventory item**: The contract mentions `type: 'currency'` with `stackable: true` — this pattern should replace the raw `cryptos` field approach
2. **Cross-page items**: Items granted by QR puzzles (`puzzleCoins`, `qr-cipher-solved` clues) live in `eyesonly_account` and `eyesonly_puzzle_state` respectively, outside the unified inventory. These should migrate to `user_inventory` rows.
3. **AccountInventory**: Works as a cross-page bridge but doesn't sync to server except during login merge. Needs the same real-time sync as currency.

### Items to Add to Contract

| Item | Source | Current Storage | Should Be |
|------|--------|----------------|-----------|
| QR puzzle coins | onSolve callbacks | eyesonly_account.puzzleCoins | user_inventory (type: currency) |
| Puzzle clues | PuzzleState.onClueFound | eyesonly_puzzle_state | user_inventory (type: key) |
| Constellation rewards | currency-increment event | NOWHERE (lost) | user_inventory (type: currency) |
| Decryption items | AccountInventory | eyesonly_account_inventory | user_inventory (already there) |
