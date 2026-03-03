# Procedural Generation Roadmap — Actionable Implementation Plan

> **Status:** Roadmap Draft  
> **Last Updated:** 2026-03-02  
> **Purpose:** Transform biome topology patterns into implementable phases

---

## 🚀 Quick Start — Implementation Phases

```
Phase 1: Scalar Field Foundation
        │
        ├─► 1.1 ScalarField class (Float32Array)
        ├─► 1.2 BasePattern interface
        └─► 1.3 Integration with floor-gen-core.js

Phase 2: Pattern Modules
        │
        ├─► 2.1 ReactionDiffusion (spots/stripes)
        ├─► 2.2 Voronoi (district/territory)
        ├─► 2.3 Radial (boss/anomaly)
        ├─► 2.4 Branch/DLA (frontier)
        └─► 2.5 Biome-to-Pattern mapping

Phase 3: Constraint & Tile Classification
        │
        ├─► 3.1 Connectivity enforcement
        ├─► 3.2 Corridor compression (chokepoints)
        ├─► 3.3 Basin detection (narrative anchors)
        └─► 3.4 Curvature-aware spawns

Phase 4: Pressure Fields & Dynamic Mutation
        │
        ├─► //// 4.1 Faction pressure layers
        ├─► //// 4.2 Resource gradients
        ├─► 4.3 In-run mutation events
        └─► 4.4 Persistent world drift

Phase 5: Designer Integration
        │
        ├─► 5.1 World Designer pattern config
        ├─► 5.2 Export extensions
        └─► 5.3 M-Console hooks
```

---

## Phase 1: Scalar Field Foundation

### 1.1 Core Data Model

Create `public/js/pattern-engine/ScalarField.js`:

```javascript
// Core scalar field container
export class ScalarField {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height);
  }

  index(x, y) {
    return y * this.width + x;
  }

  get(x, y) {
    return this.data[this.index(x, y)];
  }

  set(x, y, value) {
    this.data[this.index(x, y)] = value;
  }

  forEach(callback) {
    for (let i = 0; i < this.data.length; i++) {
      callback(this.data[i], i);
    }
  }
}
```

**Target:** <10ms generation for 128×128

### 1.2 Base Pattern Interface

Create `public/js/pattern-engine/BasePattern.js`:

```javascript
export class BasePattern {
  constructor(seed, width, height, params = {}) {
    this.seed = seed;
    this.width = width;
    this.height = height;
    this.params = params;
  }

  generate() {
    throw new Error("generate() must be implemented");
  }
}
```

### 1.3 Integration with floor-gen-core.js

Modify `public/js/floor-gen-core.js` to add pattern generation step:

```javascript
// Add after ctx.setGrid(ctx.createEmptyGrid());
if (ctx.isProceduralFloor()) {
  const patternConfig = ctx.getPatternConfig(ctx.getFloor());
  const field = PatternEngine.create(
    patternConfig.type,
    ctx.getBaseSeed(),
    40,  // grid width
    20,  // grid height
    patternConfig.params
  ).generate();
  
  ctx.applyFieldToGrid(field, patternConfig.tileMapping);
}
```

---

## Phase 2: Pattern Modules

### 2.1 Reaction Diffusion (Spots / Stripes)

Create `public/js/pattern-engine/ReactionDiffusionPattern.js`:

```javascript
import { ScalarField } from "./ScalarField.js";
import { BasePattern } from "./BasePattern.js";

export class ReactionDiffusionPattern extends BasePattern {
  generate() {
    const A = new Float32Array(this.width * this.height);
    const B = new Float32Array(this.width * this.height);

    const {
      feed = 0.055,
      kill = 0.062,
      diffA = 1.0,
      diffB = 0.5,
      iterations = 200
    } = this.params;

    // Initialize
    for (let i = 0; i < A.length; i++) {
      A[i] = 1;
      B[i] = 0;
    }

    // Seed center disturbance
    const center = (this.height / 2 | 0) * this.width + (this.width / 2 | 0);
    B[center] = 1;

    for (let t = 0; t < iterations; t++) {
      this.step(A, B, diffA, diffB, feed, kill);
    }

    const field = new ScalarField(this.width, this.height);
    field.data.set(B);
    return field;
  }

  step(A, B, diffA, diffB, feed, kill) {
    const w = this.width;
    const h = this.height;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;

        const lapA = (A[i - 1] + A[i + 1] + A[i - w] + A[i + w] - 4 * A[i]);
        const lapB = (B[i - 1] + B[i + 1] + B[i - w] + B[i + w] - 4 * B[i]);

        const a = A[i];
        const b = B[i];
        const reaction = a * b * b;

        A[i] += diffA * lapA - reaction + feed * (1 - a);
        B[i] += diffB * lapB + reaction - (kill + feed) * b;
      }
    }
  }
}
```

**Topology Control:**
| Feed | Kill | Result |
|------|------|--------|
| 0.055 | 0.062 | Spots |
| 0.030 | 0.055 | Stripes |
| 0.025 | 0.060 | Labyrinths |

### 2.2 Voronoi Pattern

```javascript
export class VoronoiPattern extends BasePattern {
  generate() {
    const field = new ScalarField(this.width, this.height);
    const points = this.generatePoints(this.params.cells || 8);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let minDist = Infinity;
        for (let p of points) {
          const dx = x - p.x;
          const dy = y - p.y;
          const d = dx * dx + dy * dy;
          if (d < minDist) minDist = d;
        }
        field.set(x, y, Math.sqrt(minDist));
      }
    }
    return field;
  }
}
```

### 2.3 Radial Pattern

```javascript
export class RadialPattern extends BasePattern {
  generate() {
    const field = new ScalarField(this.width, this.height);
    const cx = this.width / 2;
    const cy = this.height / 2;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        field.set(x, y, dist);
      }
    }
    return field;
  }
}
```

### 2.4 Biome-to-Pattern Mapping

| Biome | Pattern Type | Parameters | Use Case |
|-------|--------------|------------|----------|
| Forest | ReactionDiffusion | spots (0.055/0.062) | Clustered hiding |
| Grey Cave | ReactionDiffusion | labyrinth (0.025/0.060) | Maze navigation |
| Mall | Voronoi | 6-8 cells | District shopping |
| Office | Voronoi | 4-6 cells | Cubicle territories |
| Industrial | Voronoi + Branch | 8 cells, sparse | Chain reactions |
| Aerospace | Radial | steep gradient | Boss arena |
| Boss Floors | Radial | very steep | Central threat |

---

## Phase 3: Constraint & Tile Classification

### 3.1 Field Post-Processor

```javascript
export class FieldPostProcessor {
  static normalize(field) {
    let min = Infinity, max = -Infinity;
    field.forEach(v => {
      if (v < min) min = v;
      if (v > max) max = v;
    });
    const range = max - min;
    field.forEach((v, i) => {
      field.data[i] = (v - min) / range;
    });
    return field;
  }

  static quantize(field, levels = 6) {
    field.forEach((v, i) => {
      field.data[i] = Math.floor(v * levels) / levels;
    });
    return field;
  }
}
```

### 3.2 Biome Assembler (Tile Classification)

```javascript
export class BiomeAssembler {
  static toTiles(field, rules) {
    const tiles = new Array(field.width * field.height);
    field.forEach((value, i) => {
      tiles[i] = rules(value);
    });
    return tiles;
  }
}

// Example: Forest biome
const forestTiles = BiomeAssembler.toTiles(field, v => {
  if (v > 0.7) return "🌲";  // Cluster interior
  if (v > 0.5) return "🌿";  // Mid-density
  if (v > 0.3) return "🌱";  // Edge
  return "🟫";                // Ground
});
```

### 3.3 Connectivity Enforcement

```javascript
function enforceConnectivity(grid, start, exit) {
  // Find disconnected regions
  // Run minimal corridor stitching
  // OR increase diffusion locally
  
  // Guarantees:
  // - Spawn connects to exit
  // - No sealed loot islands
  // - Boss accessible
}
```

### 3.4 Curvature-Aware Spawns

```javascript
function applyCurvatureSpawns(grid, field) {
  // Calculate local curvature at each tile
  // 
  // if concave_edge:
  //     spawn ambusher
  // if convex_bulk:
  //     spawn slow heavy
  //
  // Enemies now match topology
}
```

---

## Phase 4: Pressure Fields & Dynamic Mutation

### 4.1 Layered Field Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TILE OUTPUT                               │
├─────────────────────────────────────────────────────────────┤
│  Resource Gradients    ← moisture, elevation, heat, tech   │
│  (Modifier layer)                                              │
├─────────────────────────────────────────────────────────────┤
│  Pressure Fields        ← Red, Blue, Wild, Corruption       │
│  (Faction/territory)                                            │
├─────────────────────────────────────────────────────────────┤
│  Morphogenesis Layer   ← Reaction-diffusion, Voronoi, etc   │
│  (Primary structure)                                          │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Biome Identity Schema

```javascript
const biomeSchema = {
  morphology_signature: 'reaction_diffusion',
  pressure_alignment: 'wild',
  gradient_modifiers: { moisture: 0.8, heat: 0.3 },
  traversal_cost: 'high',
  spawn_weights: { ambusher: 0.3, slow: 0.2, elite: 0.1 },
  mutation_rules: { corruption_spread: 0.05 }
};
```

### 4.3 In-Run Mutation Events

```javascript
// Mutation types for real-time changes
const mutationTypes = {
  // Triggerable events:
  SOLAR_FLARE:     { param: 'anomaly', delta: +0.2 },
  RELIC_ACTIVATION:{ param: 'diffusion', delta: +0.1 },
  FACTION_RITUAL:  { param: 'pressure_radius', delta: +2 },
  
  // Result:
  // - Emoji tiles transform live
  // - Corridors choke
  // - Safe zones shrink
};
```

### 4.4 Pattern Parameter Scaling by Depth

Instead of just stronger enemies, deeper floors modify pattern parameters:

```javascript
function scalePatternByDepth(basePattern, floor) {
  const depthMultiplier = floor / 30;  // 0-1 scale
  
  return {
    ...basePattern,
    spots: { tighter: depthMultiplier * 0.02 },
    stripes: { narrower: depthMultiplier * 0.05 },
    voronoi: { cells_shrink: -depthMultiplier * 1 },
    radial: { steepness: depthMultiplier * 0.3 },
    branches: { thinner: depthMultiplier * 0.1 }
  };
}
```

---

## Phase 5: Designer Integration

### 5.1 World Designer Node Properties

Extend node data in `world-designer.js`:

```javascript
{
  id: 'node-id',
  name: 'Floor Name',
  type: 'step',
  
  // NEW: Pattern configuration
  generationType: 'PROCEDURAL',  // or CONTRIVED
  patternType: 'REACTION_DIFFUSION',  // VORONOI, RADIAL, BRANCH
  patternParams: {
    feed: 0.055,
    kill: 0.062,
    iterations: 200
  },
  
  // Tile mapping
  tileMapping: {
    high: '🌲',
    medium: '🌿',
    low: '🟫'
  },
  
  // Mutation config
  mutationBudget: 100,
  enableDrift: true
}
```

### 5.2 Export Structure

```javascript
function exportWorld() {
  const worldData = {
    nodes: [...],
    connections: [...],
    
    // Pattern engine config
    patternDefaults: {
      type: 'REACTION_DIFFUSION',
      params: { feed: 0.055, kill: 0.062, iterations: 200 }
    },
    
    // Per-node overrides
    nodePatterns: {
      [nodeId]: { type: 'VORONOI', params: { cells: 6 } }
    }
  };
}
```

### 5.3 Integration with Existing Systems

| Component | Integration Point |
|-----------|-------------------|
| `biome-config.js` | Use existing biome weights, map to pattern types |
| `floor-gen-core.js` | Add pattern generation step before room gen |
| `world-designer.js` | Extend export with patternConfig |
| `COLLECTIBLES_CANON.md` | Use 9 categories for tile mapping |

---

## Reference: Existing Implementation

### Current Systems (Don't Break)

| System | Location | Status |
|--------|----------|--------|
| Biome selection | `biome-config.js` | ✅ Implemented |
| Floor generation | `floor-gen-core.js` | ✅ Implemented |
| Vents system | `BIOME_SYSTEMS.md` | ✅ Documented |
| Collectibles | `COLLECTIBLES_CANON.md` | ✅ Documented |

### Code Locations

```
public/js/
├── biome-config.js           # Existing biome weights
├── floor-gen-core.js          # Existing floor gen
└── pattern-engine/           # NEW: Pattern modules
    ├── ScalarField.js
    ├── BasePattern.js
    ├── ReactionDiffusionPattern.js
    ├── VoronoiPattern.js
    ├── RadialPattern.js
    ├── FieldPostProcessor.js
    ├── BiomeAssembler.js
    └── PatternEngine.js
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create ScalarField class
- [ ] Create BasePattern interface
- [ ] Add to floor-gen-core.js integration point
- [ ] Verify <10ms performance

### Phase 2: Patterns
- [ ] Implement ReactionDiffusionPattern
- [ ] Implement VoronoiPattern
- [ ] Implement RadialPattern
- [ ] Create PatternEngine factory
- [ ] Map biomes to pattern types

### Phase 3: Constraints
- [ ] Implement FieldPostProcessor (normalize, quantize)
- [ ] Implement BiomeAssembler
- [ ] Add connectivity enforcement
- [ ] Add curvature-aware spawns

### Phase 4: Dynamic
- [ ] Add pressure field layer
- [ ] Add resource gradient layer
- [ ] Implement mutation events
- [ ] Add depth-based scaling

### Phase 5: Designer
- [ ] Extend World Designer node properties
- [ ] Update exportWorld function
- [ ] Add M-Console hooks

---

## Next Steps

1. **Start with Phase 1** — Create ScalarField class
2. **Test pattern generation** — Verify <10ms for 128×128
3. **Integrate with biome-config.js** — Map existing biomes
4. **Proceed to Phase 3** — Add constraint layer
5. **Phase 5 last** — Connect to designer tools
