import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, 'public', 'data', 'gone-rogue', 'enemy-catalog.json');

function normKey(k) {
  return String(k || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

function ensure(obj, k, v) {
  if (obj[k] === undefined) obj[k] = v;
  return obj[k];
}

function addDeck(catalog, key, def) {
  const decks = ensure(catalog, 'decks', {});
  const kk = normKey(key);
  if (decks[kk]) return; // don't overwrite
  decks[kk] = {
    keyName: kk,
    pool: def.pool,
    handSize: def.handSize ?? def.pool.length,
    deckMode: def.deckMode ?? 'fixed',
    guarantees: def.guarantees ?? [],
    exposedTags: def.exposedTags ?? [],
    note: def.note ?? ''
  };
}

function addArchetype(catalog, key, def) {
  const arch = ensure(catalog, 'archetypes', {});
  const kk = normKey(key);
  if (arch[kk]) return;
  arch[kk] = {
    name: def.name,
    description: def.description ?? '',
    baseStats: def.baseStats ?? {},
    deckByFloor: def.deckByFloor ?? []
  };
}

function addSpawnBand(catalog, floors, weights) {
  const bands = ensure(catalog, 'spawnBands', []);
  bands.push({ floors, weights });
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
  catalog.notes = (catalog.notes || '') + '\n\n[onboarding] Expanded with civilian/location decks + archetypes for catacombs/tavern/datacenter/hydroponics/homes/fightclubs/junkyards.';

  // ── CIVILIAN DECKS (non-lethal-ish / low-tier) ───────────────────────────
  addDeck(catalog, 'CIVILIAN_TYPE_A', {
    pool: ['EATK-008'],
    exposedTags: ['pickpocket'],
    note: 'Baseline civilian: panics and lashes out with a small knife.'
  });
  addDeck(catalog, 'CIVILIAN_TYPE_B', {
    pool: ['EATK-009', 'EATK-008'],
    exposedTags: ['sleight', 'pickpocket'],
    note: 'Grabby civilian: grapple + knife. Mostly control.'
  });
  addDeck(catalog, 'CIVILIAN_TYPE_C', {
    pool: ['EATK-019', 'EATK-008'],
    exposedTags: ['bribe', 'pickpocket'],
    note: 'Shady civilian: coin toss distraction + knife. Loot-flavored.'
  });

  addDeck(catalog, 'CIVILIAN_BRAWLER', {
    pool: ['EATK-005', 'EATK-009'],
    exposedTags: ['intimidate'],
    note: 'Brawler: heavy swing + grapple. Fight-club vibe.'
  });
  addDeck(catalog, 'CIVILIAN_TWEAKER', {
    pool: ['EATK-008', 'EATK-008', 'EATK-009'],
    exposedTags: ['sleight', 'pickpocket'],
    note: 'Unstable speed: double knife + grapple.'
  });
  addDeck(catalog, 'CIVILIAN_SCRAPPER', {
    pool: ['EATK-009', 'EATK-016'],
    exposedTags: ['intimidate', 'disarm'],
    note: 'Scrapper: improvised control + shove/charge.'
  });

  addDeck(catalog, 'CONSTRUCTION_WORKER', {
    pool: ['EATK-005', 'EATK-013'],
    exposedTags: ['intimidate'],
    note: 'Worker with gear: axe tool swing + brief defensive brace.'
  });
  addDeck(catalog, 'GRANNY', {
    pool: ['EATK-010'],
    exposedTags: ['bribe'],
    note: 'Granny with a flashlight: exposes player (low damage but high stealth impact).'
  });
  addDeck(catalog, 'PUNKS_PAIR', {
    pool: ['EATK-008', 'EATK-002'],
    exposedTags: ['pickpocket', 'disarm'],
    note: 'Two-punks vibe: knife + burst fire.'
  });

  // ── LOCATION / FACTION DECKS ────────────────────────────────────────────
  addDeck(catalog, 'HOMEOWNER_DEFENDER', {
    pool: ['EATK-001', 'EATK-013'],
    exposedTags: ['bribe'],
    note: 'Home defense: pistol + defensive stance. Easy to de-escalate (bribe).'
  });

  addDeck(catalog, 'FIGHT_CLUB_THUG', {
    pool: ['EATK-005', 'EATK-008', 'EATK-009'],
    exposedTags: ['intimidate', 'disarm'],
    note: 'Fight club: heavy hit + knife + grapple. Steal disarm options.'
  });

  addDeck(catalog, 'JUNKYARD_SCAVENGER', {
    pool: ['EATK-009', 'EATK-008', 'EATK-019'],
    exposedTags: ['pickpocket', 'sleight', 'bribe'],
    note: 'Junkyard: improvised grabs + knife + coin tricks.'
  });

  addDeck(catalog, 'TAVERN_BASEMENT_ROWDY', {
    pool: ['EATK-009', 'EATK-008', 'EATK-013'],
    exposedTags: ['pickpocket', 'intimidate'],
    note: 'Basement rowdy: grapple + knife + brace.'
  });

  addDeck(catalog, 'CHURCH_CATACOMBS_WARDEN', {
    pool: ['EATK-010', 'EATK-007', 'EATK-013'],
    exposedTags: ['hack', 'disarm'],
    note: 'Catacombs warden: reveal/expose + stun + defensive wall.'
  });

  addDeck(catalog, 'DATACENTER_SECURITY', {
    pool: ['EATK-017', 'EATK-010', 'EATK-011'],
    exposedTags: ['hack', 'disarm'],
    note: 'Server room security: paint/spotlight + aimed shot (high detection).'
  });

  addDeck(catalog, 'HYDROPONICS_TECH', {
    pool: ['EATK-006', 'EATK-010', 'EATK-008'],
    exposedTags: ['hack', 'sleight'],
    note: 'Hydroponics worker-tech: chemical splash + flashlight + knife.'
  });

  // ── ARCHETYPES (designer vocabulary) ────────────────────────────────────
  addArchetype(catalog, 'CIVILIAN', {
    name: 'Civilian',
    description: 'Non-military actors. Low lethality but can create chaos if mishandled.',
    baseStats: { hp: [2, 6], sightRange: [2, 5], moveSpeed: [0.8, 1.2] },
    deckByFloor: [
      { maxFloor: 5, deck: 'CIVILIAN_TYPE_A' },
      { maxFloor: 10, deck: 'CIVILIAN_TYPE_B' },
      { maxFloor: 30, deck: 'CIVILIAN_TYPE_C' }
    ]
  });

  addArchetype(catalog, 'FIGHTER', {
    name: 'Civilian Fighter',
    description: 'Fight clubs / rowdies / scrappers. High control and melee pressure.',
    baseStats: { hp: [5, 12], sightRange: [3, 6], moveSpeed: [0.9, 1.3] },
    deckByFloor: [
      { maxFloor: 10, deck: 'CIVILIAN_BRAWLER' },
      { maxFloor: 30, deck: 'FIGHT_CLUB_THUG' }
    ]
  });

  addArchetype(catalog, 'SECURITY', {
    name: 'Security',
    description: 'Guards + facility security. Detection-forward decks.',
    baseStats: { hp: [4, 10], sightRange: [5, 10], moveSpeed: [0.9, 1.1] },
    deckByFloor: [
      { maxFloor: 10, deck: 'GENERIC_FLOOR_10' },
      { maxFloor: 20, deck: 'ARMORED_GUARD' },
      { maxFloor: 30, deck: 'DATACENTER_SECURITY' }
    ]
  });

  addArchetype(catalog, 'CATACOMBS', {
    name: 'Catacombs Inhabitants',
    description: 'Low light, tight spaces: stun/expose/defense patterns.',
    baseStats: { hp: [4, 11], sightRange: [4, 9], moveSpeed: [0.8, 1.1] },
    deckByFloor: [
      { maxFloor: 30, deck: 'CHURCH_CATACOMBS_WARDEN' }
    ]
  });

  // ── SPAWN BANDS (lightweight defaults) ──────────────────────────────────
  // These are intentionally conservative; designers can tune.
  if (!Array.isArray(catalog.spawnBands) || catalog.spawnBands.length === 0) {
    addSpawnBand(catalog, [1, 5], { CIVILIAN: 6, SECURITY: 4, FIGHTER: 1 });
    addSpawnBand(catalog, [6, 12], { CIVILIAN: 4, SECURITY: 6, FIGHTER: 2 });
    addSpawnBand(catalog, [13, 30], { SECURITY: 7, FIGHTER: 3, CATACOMBS: 1 });
  }

  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log('[expand-enemy-catalog] Updated enemy-catalog.json with onboarding/location decks + archetypes');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
