import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'data', 'gone-rogue');

const CATALOG_PATH = path.join(DATA_DIR, 'enemy-catalog.json');
const OUT_CARDS_PATH = path.join(DATA_DIR, 'enemy-cards.json');
const OUT_DECKS_PATH = path.join(DATA_DIR, 'enemy-decks.json');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function normalizeEnemyTypeKey(k) {
  return String(k || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

function validateCatalogShape(catalog) {
  assert(catalog && typeof catalog === 'object', 'enemy-catalog.json must be an object');
  assert(Number.isInteger(catalog.version) && catalog.version >= 1, 'catalog.version must be integer >= 1');
  assert(catalog.cards && typeof catalog.cards === 'object' && !Array.isArray(catalog.cards), 'catalog.cards must be an object');
  assert(catalog.decks && typeof catalog.decks === 'object' && !Array.isArray(catalog.decks), 'catalog.decks must be an object');
}

function validateCard(id, card) {
  assert(/^EATK-\d{3}$/.test(id), `Card key must be EATK-###, got: ${id}`);
  assert(card && typeof card === 'object', `Card ${id} must be an object`);
  for (const req of ['name', 'emoji', 'intentType', 'targetType', 'damage', 'accuracy', 'speed', 'effects']) {
    assert(card[req] !== undefined, `Card ${id} missing required field: ${req}`);
  }
  assert(Array.isArray(card.effects) && card.effects.length > 0, `Card ${id}.effects must be non-empty array`);
  assert(Number.isInteger(card.damage) && card.damage >= 0, `Card ${id}.damage must be integer >= 0`);
  assert(Number.isInteger(card.accuracy) && card.accuracy >= 0 && card.accuracy <= 100, `Card ${id}.accuracy must be 0..100`);
  assert(Number.isInteger(card.speed) && card.speed >= 0 && card.speed <= 10, `Card ${id}.speed must be 0..10`);
}

function validateDeck(deckKey, deck, allCardIds) {
  assert(deck && typeof deck === 'object', `Deck ${deckKey} must be an object`);
  assert(Array.isArray(deck.pool) && deck.pool.length > 0, `Deck ${deckKey}.pool must be non-empty array`);
  assert(Number.isInteger(deck.handSize) && deck.handSize >= 1 && deck.handSize <= 12, `Deck ${deckKey}.handSize must be 1..12`);
  assert(Array.isArray(deck.exposedTags), `Deck ${deckKey}.exposedTags must be array`);

  for (const cid of deck.pool) {
    assert(allCardIds.has(cid), `Deck ${deckKey} references missing card: ${cid}`);
  }
  if (Array.isArray(deck.guarantees)) {
    for (const gid of deck.guarantees) {
      assert(allCardIds.has(gid), `Deck ${deckKey}.guarantees references missing card: ${gid}`);
    }
    assert(deck.guarantees.length <= deck.handSize, `Deck ${deckKey}: guarantees.length must be <= handSize`);
  }
  if (deck.deckMode && !['fixed', 'draw'].includes(deck.deckMode)) {
    throw new Error(`Deck ${deckKey}.deckMode must be 'fixed' or 'draw'`);
  }
}

function compileEnemyCards(catalog) {
  // Output format expected by current registry: array of cards with embedded id.
  const out = [];
  const ids = Object.keys(catalog.cards).sort();
  for (const id of ids) {
    const card = catalog.cards[id];
    validateCard(id, card);
    out.push({ id, ...card });
  }
  return out;
}

function compileEnemyDecks(catalog) {
  // Output format expected by current registry: object keyed by deck type
  // with { cards: [...], exposedTags: [...], deckSize?: number }
  const out = {
    _schema: {
      cards: 'Array of EATK-* IDs (duplicates = multiple copies in hand)',
      exposedTags: 'Tags that match player item stealTags for pre-combat stealing',
      deckSize: 'Optional override — if set, randomly draws N from cards pool each combat'
    }
  };

  const allCardIds = new Set(Object.keys(catalog.cards));
  const deckKeys = Object.keys(catalog.decks).map(normalizeEnemyTypeKey).sort();

  // detect collisions after normalization
  const seen = new Map();
  for (const rawKey of Object.keys(catalog.decks)) {
    const nk = normalizeEnemyTypeKey(rawKey);
    if (seen.has(nk)) {
      throw new Error(`Deck key collision after normalization: ${rawKey} and ${seen.get(nk)} both -> ${nk}`);
    }
    seen.set(nk, rawKey);
  }

  for (const deckKey of deckKeys) {
    const rawKey = seen.get(deckKey);
    const deck = catalog.decks[rawKey];

    validateDeck(deckKey, deck, allCardIds);

    const deckMode = deck.deckMode || 'fixed';

    // fixed mode: output cards exactly as pool list
    // draw mode: output cards as pool list but set deckSize to handSize so runtime can random-draw
    out[deckKey] = {
      cards: deck.pool.slice(),
      exposedTags: (deck.exposedTags || []).slice(),
      _note: deck.note || deck._note || undefined,
      deckSize: deckMode === 'draw' ? deck.handSize : undefined
    };

    // strip undefined keys for clean JSON
    if (out[deckKey]._note === undefined) delete out[deckKey]._note;
    if (out[deckKey].deckSize === undefined) delete out[deckKey].deckSize;
  }

  // also allow non-schema note keys (safe)
  if (catalog.notes) {
    out._catalogNote = String(catalog.notes);
  }

  return out;
}

async function main() {
  const raw = await fs.readFile(CATALOG_PATH, 'utf8');
  const catalog = JSON.parse(raw);
  validateCatalogShape(catalog);

  const cards = compileEnemyCards(catalog);
  const decks = compileEnemyDecks(catalog);

  await fs.writeFile(OUT_CARDS_PATH, stableStringify(cards), 'utf8');
  await fs.writeFile(OUT_DECKS_PATH, stableStringify(decks), 'utf8');

  console.log(`[enemy-catalog] wrote:`);
  console.log(`  - ${path.relative(ROOT, OUT_CARDS_PATH)} (${cards.length} cards)`);
  console.log(`  - ${path.relative(ROOT, OUT_DECKS_PATH)} (${Object.keys(decks).length - 1} decks)`);
}

main().catch((err) => {
  console.error('[enemy-catalog] ERROR:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
