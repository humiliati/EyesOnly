# Gone Rogue — Narrative Alignment Document
## Sandpoint, Idaho Setting Integration

**Date:** 2026-03-06
**Scope:** Map real Sandpoint/CDA geography to game biomes, identify gaps, align boss arenas to real locations

---

## 1. The Real Sandpoint

Sandpoint is the county seat of Bonner County, population ~9,800, sitting on the north shore of Lake Pend Oreille — Idaho's largest lake at 43 miles long, over 1,100 feet deep, ringed by the Selkirk, Cabinet, and Bitterroot mountain ranges. The town is built where Sand Creek empties into the lake, with the Long Bridge providing the only southern access across the water from Sagle.

### Key Industries (Real)
- **Timber / Forest Products** — 82% of Bonner County is forested land. Timber has been the economic backbone since the 1890s. Humbird Lumber Company operated 1900–1944. Idaho Forest Group, Merritt Brothers, and smaller mills remain active.
- **Litehouse Foods** — Headquartered at 1109 N Ella Ave. America's #1 refrigerated salad dressing. Multiple plants in Sandpoint producing blue cheese, buttermilk, and dressings. $6.2M expansion recently completed.
- **Daher / Quest Aircraft** — Builds the Kodiak 100 and Kodiak 900 turboprops. Utility aircraft used worldwide. Factory at the Sandpoint Airport (5,500-ft paved runway).
- **BNSF Railway Hub** — Sandpoint Junction is where Montana Rail Link's line from Missoula joins the BNSF main, nicknamed "the funnel." Three major rail lines converge here. Idaho's only Amtrak station (Empire Builder line). The historic 1916 Gothic Revival depot is on the National Register.
- **Tourism / Recreation** — Schweitzer Mountain Resort (Idaho's largest ski area). Lake recreation. Cedar Street Bridge marketplace (Ponte Vecchio–inspired bridge over Sand Creek with shops).
- **Silver Valley Mining** (40 miles east via I-90) — Coeur d'Alene Mining District: richest silver district in America. 1.18 billion ounces of silver since 1884. Bunker Hill Mine and Smelter (world's largest when built). Towns: Kellogg, Wallace, Mullan.

### Key Landmarks (Real)
- **The Long Bridge** — 2-mile crossing over Lake Pend Oreille, originally 1,540 wooden pilings (1908). Fourth bridge built 1981. Third bridge preserved as bike/walk path.
- **Sandpoint Train Depot** — 1916 red brick Gothic Revival, oldest active Northern Pacific depot.
- **Cedar Street Bridge** — Marketplace over Sand Creek, inspired by Ponte Vecchio.
- **Panida Theater** — 1927 cultural landmark, events and performances.
- **Schweitzer Mountain** — 2,900 acres of skiable terrain directly above town.
- **Lake Pend Oreille** — Deep enough that the US Navy tested submarine prototypes here during WWII (Farragut Naval Training Station at the south end, now a state park).
- **Sandpoint Gun Club** — 1790 East Shingle Mill Rd.

---

## 2. Existing Biome System → Sandpoint Retheme

The current 6-biome progression can be narratively aligned to real Sandpoint geography without changing any game mechanics. The biome names, descriptions, wall tiles, and atmospheric text get rethemed; the floor ranges, enemy density, tile effects, and gameplay remain identical.

### Biome Retheme Map

| Current Biome | Floors | Sandpoint Retheme | Real Location Basis | Narrative Context |
|--------------|--------|-------------------|--------------------|--------------------|
| Cozy Forest | 1–3 | **Kaniksu Timberland** | Bonner County forest (82% forested), Humbird Lumber ghost sites | Tutorial area. Player awakens in the deep forest surrounding Sandpoint. Old logging roads, abandoned lumber camps. The Kaniksu Protocol's origin territory. |
| Grey Cave | 4 | **Bunker Hill Mines** | Silver Valley mine shafts, Bunker Hill smelter tunnels | Stealth floor. Player descends into abandoned silver mine tunnels east of town. Toxic waste from century of smelting. The Kaniksu Network hid artifacts here. |
| Commercial Office | 5–9 | **Litehouse Corporate** | Litehouse Foods HQ/factory complex on Ella Ave | Corporate espionage floors. The dressing factory is a front. Behind the cheese aging rooms and shipping docks, encrypted terminals and surveilled corridors. |
| Shopping Mall | 11–15 | **Cedar Street Market** | Cedar Street Bridge marketplace, downtown Sandpoint retail district | Urban infiltration. The Ponte Vecchio–style bridge market hides dead drops. Storefront fronts for faction safe houses. Tourist crowds provide cover and complications. |
| Industrial Complex | 17–21 | **Kodiak Assembly Plant** | Daher/Quest Aircraft factory at Sandpoint Airport | High-security manufacturing. The turboprop factory builds more than planes. Conveyor belts, welding bays, fuel storage. Heavy industrial hazards. Where Project Chimera hardware is fabricated. |
| Aerospace Museum | 23–30 | **Farragut Naval Station** | Farragut Naval Training Station ruins at south end of Lake Pend Oreille (WWII submarine testing facility, now state park) | Endgame. The decommissioned naval station where the Navy tested submarine prototypes in the 1940s. Vast underground docks, Cold War–era infrastructure. The Falcon Initiative's hidden command center. |

### What Changes
- Biome `name` and `description` fields in `biomes.json`
- Tooltip/flavor text in status line
- NPC dialogue references
- ARG location cross-references in `streets.json` and `arg_locations.json`

### What Stays Identical
- All `wallTiles`, `floorTiles`, `tileEffects`, `props` arrays
- `floorRange`, `enemyDensity`, `backgroundGradient`
- All gameplay mechanics, enemy spawns, card drop tables
- Biome bleed, vent spawn rates, floor shuffling weights

---

## 3. Building Interior Retheme

Interior biomes (from BUG 9 in the audit) also align to Sandpoint locations:

| Interior Biome | Sandpoint Retheme | Real Basis |
|---------------|-------------------|------------|
| INTERIOR_TAVERN | **The Hound's Tooth Pub** | One of Sandpoint's actual bars/restaurants. Warm wood, firelight, rumors. |
| INTERIOR_CHURCH | **St. Joseph's Parish** | Real Catholic parish in Sandpoint. Connects to the Jesuit thread of the Kaniksu Protocol. |
| INTERIOR_CATACOMBS | **Jesuit Reliquary** | Fictional catacombs beneath the church. Where the 400-year Kaniksu Protocol documents are hidden. |
| INTERIOR_STRIP_MALL | **Bridge Market Shops** | Individual storefronts within Cedar Street Bridge. Sugar Tooth candy shop, galleries, craft vendors. |
| INTERIOR_FACTORY | **Litehouse Processing Floor** | Inside the dressing factory. Vats, coolers, conveyor lines. The $6.2M expansion hides something. |
| INTERIOR_APARTMENT | **Lakeview Rentals** | Sandpoint residential. Views of the lake. Where field agents maintain cover identities. |
| INTERIOR_JUNKYARD | **Shingle Mill Salvage** | Named after Shingle Mill Rd (near the gun club). Scrap from old lumber mills and rail equipment. |
| INTERIOR_SILO | **Farragut Submarine Pen** | The WWII submarine testing docks beneath Farragut. Missile housing references the naval weapons history. |

---

## 4. Boss Arena Narrative Alignment

Each boss minigame from `BOSS_DESIGN.md` maps to a specific Sandpoint location. These boss arenas are the special biomes defined in BUG 11.

### Frogger Boss: Train Depot Crossing
**Real Location:** Sandpoint Junction — BNSF rail hub, "the funnel," where Montana Rail Link joins the BNSF main. Idaho's only Amtrak stop.

**Narrative:** The meet is compromised at the Sandpoint train depot. The 1916 brick depot sits at the convergence of three rail lines. Freight trains from the timber mills, Amtrak's Empire Builder, and MRL traffic from Missoula create a lethal grid of moving steel. The player must cross the active yard to reach the extraction point on the far platform.

**Biome:** `BOSS_TRAIN_DEPOT` — horizontal lane layout, 5–7 active tracks, platforms between lanes. Freight cars, passenger cars, maintenance cranes. The historic red brick depot visible in the background. Night setting with industrial floodlights.

**Design note:** This is the BOSS_DESIGN.md "Frogger Boss: Train Depot Crossing" — the doc already names it a train depot. It maps 1:1 to the real Sandpoint rail junction.

### Frogger Boss Variant: Long Bridge Crossing
**Real Location:** The Long Bridge — 2-mile span across Lake Pend Oreille connecting Sagle to Sandpoint.

**Narrative:** Extraction vehicle is waiting on the Sandpoint side. Player starts on the Sagle side. The bridge is two miles of narrow road with no shoulder — just water on both sides. Traffic doesn't stop. Vehicles approach from both directions on the two lanes plus the preserved third bridge (bike/pedestrian path) that's now being used by motorcycle couriers.

**Biome:** `BOSS_LONG_BRIDGE` — tight narrow horizontal play area (5 tiles tall), water border top and bottom (lethal), 4 traffic lanes with alternating direction. Cars, trucks, semis, motorcycles at varying speeds. The playable corridor is claustrophobically thin. Lake Pend Oreille stretches in every direction. Mountains visible on the horizon.

**Design note:** This could be a variant Frogger boss or a separate boss encounter. The Long Bridge's real geography (extremely narrow, extremely long, water everywhere) naturally creates the "frogger on a tightrope" feel the stakeholder described.

### SkiFree Boss: Schweitzer Descent
**Real Location:** Schweitzer Mountain Resort — 2,900 skiable acres directly above Sandpoint.

**Narrative:** The handoff went wrong at the Schweitzer summit lodge. Now the player is skiing down the mountain with pursuit agents and avalanche conditions. The extraction helicopter waits at the base lodge.

**Biome:** `BOSS_SKI_MOUNTAIN` — vertical scrolling downhill. Pine trees (Kaniksu forest bleeds into this), boulders, ski lift towers. The "abominable snowman" pursuer is reimagined as a Kaniksu Network enforcer on a snowmobile.

### Sniper Boss: Lakeview Observation
**Real Location:** Overlooking Lake Pend Oreille from one of the surrounding ridgelines (Selkirk or Cabinet range).

**Narrative:** The target is meeting a contact at the Sandpoint City Beach pavilion. The player sets up a position on the ridgeline across the lake — a mile of open water between scope and target. Wind off the lake, boat traffic crossing the sightline, the target moving between cover near the Cedar Street Bridge.

### Asteroids Boss: Farragut Void
**Real Location:** Farragut Naval Training Station — the deep lake where the Navy tested submarine prototypes.

**Narrative:** The Falcon Initiative's underwater facility beneath Lake Pend Oreille. The "asteroids" are debris from a collapsing deep-water structure. The "space" is the black void of a 1,100-foot-deep freshwater lake. The enemy vessel is a Kaniksu Network submarine drone.

### Snake Boss: Litehouse Network Breach
**Real Location:** Litehouse Foods corporate network / the factory's industrial control system.

**Narrative:** The player hacks into the Litehouse Foods industrial control network to extract encrypted data hidden in the factory's process control system. The "snake" is the data extraction probe navigating the network topology. Security programs are the factory's cyber-defense. The data reveals shipping manifests that prove the dressing factory is a logistics front for Project Chimera biological material transport.

### Tower Attack Boss: Quest Aircraft Hangar
**Real Location:** Daher/Quest Aircraft manufacturing facility at Sandpoint Airport.

**Narrative:** The Kodiak assembly hangar has been fortified by the Kaniksu Network as a forward operating base. The "tower" is the hangar control tower and its automated defense grid. The player must breach the facility from the airfield perimeter, taking out defense systems tier by tier.

---

## 5. Narrative Gaps — What's Missing

### GAP 1: No Lake Biome
Lake Pend Oreille is the geographic centerpiece of Sandpoint. It's the largest lake in Idaho, over 1,100 feet deep, and the reason the town exists. But there's no water/lake biome in the game.

**Recommendation:** Add a transitional "Lakeshore" biome that appears between the Forest and Cave biomes (possibly as a floor 3.5 or bonfire variant). Water tiles, dock structures, fishing boats, lakefront cabins. This would bridge the forest tutorial into the underground cave narratively — the player descends from the lakeshore into the mine tunnels.

### GAP 2: No Logging / Timber Mill Interior
Timber is 20%+ of the county economy. Old-growth logging is the historical foundation of Sandpoint. The Humbird Lumber Company mill site is a real landmark. But there's no sawmill or logging camp interior biome.

**Recommendation:** Add `INTERIOR_SAWMILL` as an interior biome under the Forest overworld. Wall tiles: stacked lumber, sawblades, belt conveyors. Props: log piles, sawdust mounds, mechanical saws. This slots naturally as a building interior on floors 1–3 where the Forest biome operates. Narratively, it's an abandoned Humbird-era mill where the Kaniksu Network cached weapons.

### GAP 3: No Gun Club / Shooting Range
The Sandpoint Gun Club at Shingle Mill Rd is referenced in the ARG context and is geographically adjacent to the Long Bridge approach (Gun Club Road runs south of town toward the bridge). A shooting range interior could serve as the "training ground" where the Sniper boss practice mode takes place.

**Recommendation:** Add `INTERIOR_RANGE` as an interior biome. Lanes, target stands, ammunition lockers, noise-dampened walls. Could double as the Sniper boss's practice area and a narrative location where agents train.

### GAP 4: Amtrak / Train Interior Missing
The Sandpoint depot is Idaho's only Amtrak station. The Empire Builder runs daily to Seattle/Portland and Chicago. A train car interior would be a natural setting for an escape sequence or a narrative scene (meeting a contact aboard the train).

**Recommendation:** Add `INTERIOR_TRAIN_CAR` — narrow horizontal layout (train car proportions), passenger seats, luggage racks, vestibule doors. Could appear as a special floor between biome transitions or as a cutscene/narrative-only space.

### GAP 5: WWII / Naval History Not Utilized
Farragut Naval Training Station (south end of Lake Pend Oreille) was the second-largest naval training center in the world during WWII, processing nearly 300,000 sailors. The lake was used for acoustic research and submarine prototype testing. This is rich material for the spy narrative that's barely touched.

**Recommendation:** The Aerospace biome rethemed as "Farragut Naval Station" partially addresses this, but the WWII history deserves more than just a name change. Consider:
- Adding WWII-era props (naval signal flags, sonar equipment, depth charge racks) to the Aerospace/Farragut biome
- A special Farragut floor type with bunker-style rooms and flooded corridors
- Narrative beats connecting the Falcon Initiative's modern operation to the station's classified WWII-era submarine research

### GAP 6: The Kaniksu Protocol Isn't Physically Grounded
The ARG narrative centers on the "Kaniksu Protocol" — a 400-year Jesuit conspiracy — but the game biomes don't have any physical location where this protocol would be stored or discovered. The Church interior + Catacombs interior partially address this, but the protocol's discovery should be a major narrative moment tied to a specific floor.

**Recommendation:** Floor 4 (Grey Cave / Bunker Hill Mines) is the best candidate. As the player descends into the mine tunnels, they discover a sealed Jesuit chamber predating the mining operations. The Protocol documents are found here, setting up the mid-game faction conflict. This requires a special room type within the cave biome — a "reliquary" sub-room with church interior wall tiles bleeding into the cave environment.

---

## 6. Biome Progression — Narrative Arc

The rethemed biome progression tells a coherent Sandpoint spy story:

| Floor | Biome | Narrative Beat |
|-------|-------|---------------|
| 0 | Kaniksu Timberland (tutorial) | Agent awakens in the deep forest. The tavern is the first safe house. Ancient Snail punching-bag teaches STR combat. |
| 1–3 | Kaniksu Timberland | Explore the logging territory. Village with church, tavern, shop. Discover the Kaniksu Network's forest surveillance posts. |
| 4 | Bunker Hill Mines | Descend into the abandoned silver mines. Discover the sealed Jesuit reliquary. First encounter with the Kaniksu Protocol. |
| 5–9 | Litehouse Corporate | Infiltrate the dressing factory's corporate offices. Extract encrypted data from terminals. The factory is a logistics front. |
| ~10 | **BOSS: Train Depot** | Meet compromised at the rail junction. Frogger crossing of active rail yard. |
| 11–15 | Cedar Street Market | Urban infiltration through downtown Sandpoint. Dead drops in the bridge market. Tourist crowds as cover. Faction safe houses in storefronts. |
| ~16 | **BOSS: Long Bridge** | Extraction across the 2-mile bridge. Frogger traffic variant. Water on both sides. No margin for error. |
| 17–21 | Kodiak Assembly Plant | Break into the aircraft factory. Heavy industrial hazards. Project Chimera hardware discovered. |
| ~22 | **BOSS: Schweitzer Descent** | SkiFree down the mountain after a blown handoff. Snowmobile pursuit. |
| 23–29 | Farragut Naval Station | The endgame facility. WWII submarine docks beneath the lake. The Falcon Initiative's command center. |
| 30 | **FINAL BOSS** | The convergence. All faction threads resolve. |

---

## 7. Cross-Reference: Existing Docs

| Document | Relationship to This Doc |
|----------|------------------------|
| `BOSS_DESIGN.md` | Boss minigame mechanics → this doc maps them to Sandpoint locations |
| `BIOME_SYSTEMS.md` | Biome catalog → this doc rethemes each entry |
| `WORLD_BUILDING_ENGINE.md` | WBE Step Nodes → this doc provides narrative tags per node |
| `LIVE_EXERCISE_NARRATIVE_SAMPLE.md` | Operation Kaniksu Eclipse → this doc aligns digital biomes to live ARG geography |
| `BUILDING_INTERIOR_SYSTEM.md` | Interior architecture → this doc maps interiors to real Sandpoint buildings |
| `TUTORIAL_FLOORS_AUDIT.md` | Bugs 11 and 12 reference this document directly |
| `streets.json` | Street Chronicles locations → this doc aligns them to biome geography |
| `arg_locations.json` | ARG locations (Hollow Creek) → this doc provides real-world counterparts |

---

## 8. Implementation Priority

1. **Retheme biome names/descriptions** — zero gameplay impact, immediate narrative coherence (edit `biomes.json` string fields)
2. **Create boss arena biomes** — required for boss implementation (BUG 11)
3. **Add INTERIOR_SAWMILL** — fills the biggest narrative gap (timber industry)
4. **Add INTERIOR_TRAIN_CAR** — supports the Train Depot boss narrative
5. **Ground the Kaniksu Protocol discovery** — special room in Grey Cave / Bunker Hill biome
6. **Connect streets.json locations** to biome geography — ARG alignment
7. **WWII naval props** for Farragut/Aerospace biome — narrative depth
