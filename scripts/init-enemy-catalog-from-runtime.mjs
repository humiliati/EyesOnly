import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'data', 'gone-rogue');

const IN_CARDS_PATH = path.join(DATA_DIR, 'enemy-cards.json');
const IN_DECKS_PATH = path.join(DATA_DIR, 'enemy-decks.json');
const OUT_CATALOG_PATH = path.join(DATA_DIR, 'enemy-catalog.json');

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function normalizeDeckKey(k) {
  return String(k || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

async function main() {
  const cardsArr = JSON.parse(await fs.readFile(IN_CARDS_PATH, 'utf8'));
  const decksObj = JSON.parse(await fs.readFile(IN_DECKS_PATH, 'utf8'));

  const catalog = {
    version: 1,
    notes: 'Bootstrapped from runtime enemy-cards.json + enemy-decks.json. Edit this file going forward; run scripts/build-enemy-catalog.mjs.',
    cards: {},
    decks: {},
    archetypes: {},
    variants: {},
    spawnBands: []
  };

  for (const c of cardsArr) {
    if (!c || !c.id) continue;
    const { id, ...rest } = c;
    catalog.cards[id] = rest;
  }

  for (const [k, v] of Object.entries(decksObj)) {
    if (k === '_schema' || k.startsWith('_')) continue;
    const kk = normalizeDeckKey(k);
    const cards = Array.isArray(v.cards) ? v.cards.slice() : [];
    const exposedTags = Array.isArray(v.exposedTags) ? v.exposedTags.slice() : [];

    // Heuristic: if deckSize exists and is <= cards.length, treat as draw recipe
    const handSize = (typeof v.deckSize === 'number' && v.deckSize > 0) ? v.deckSize : cards.length;
    const deckMode = (typeof v.deckSize === 'number' && v.deckSize > 0) ? 'draw' : 'fixed';

    catalog.decks[kk] = {
      keyName: kk,
      pool: cards,
      handSize: handSize || 1,
      deckMode,
      guarantees: [],
      exposedTags,
      note: v._note || ''
    };
  }

  await fs.writeFile(OUT_CATALOG_PATH, stableStringify(catalog), 'utf8');
  console.log(`[init-enemy-catalog] wrote ${path.relative(ROOT, OUT_CATALOG_PATH)} with ${Object.keys(catalog.cards).length} cards and ${Object.keys(catalog.decks).length} decks`);
}

main().catch((err) => {
  console.error('[init-enemy-catalog] ERROR:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
