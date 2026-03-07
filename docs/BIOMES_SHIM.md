Step 1: Add biomes.json to the Data Registry
GoneRogueDataRegistry already loads 9 JSON files (items, cards, statuses, etc.). Add biomes.json as a 10th. The fetch/index pattern is already established — just add _fetchJson(BASE + 'biomes.json') to the load() Promise.all and index by biome key.
Step 2: Create a BiomeDataProvider shim
A tiny IIFE (~40 lines) that sits between the registry and the monolith. On init(), it pulls the loaded biomes from the data registry and builds the BIOMES object in the same shape the monolith currently hardcodes. If the registry hasn't loaded yet (fallback), it returns a minimal FOREST default. This gives the monolith's _getBiome() the same object it currently gets from the closure variable, but sourced from JSON.
Step 3: Rewire the monolith
Replace var BIOMES = { ... 345 lines ... }; with var BIOMES = BiomeDataProvider.getBiomes(); — a single line. The _getBiome() function, all ctx factories, and all 35+ downstream property accesses stay identical because the object shape is unchanged. Zero consumer changes needed.
Step 4: Delete the 345-line block
Once BiomeDataProvider is wired in, the hardcoded BIOMES block is dead code. Remove it.