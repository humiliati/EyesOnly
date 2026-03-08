# Ghost Floor Implementation - Issue Report

## Issue Summary
Ghost floors (floors 3-4) in Gone Rogue currently have no enemy spawning logic implemented.

## Current Behavior
```javascript
// Line 2393-2395 in public/js/gone-rogue.js
if (floorType === FLOOR_TYPES.GHOST) {
  // TODO: Implement camera/drone surveillance system
  return;
}
```

**Result**: Floors 3-4 spawn with NO enemies, making them trivially easy and breaking the intended progression curve.

## Expected Behavior
According to game design, Ghost floors should feature:
- Camera/drone surveillance system
- Non-lethal monitoring enemies
- Stealth-focused gameplay mechanics
- Detection systems that don't result in immediate combat

## Impact
- **Severity**: Medium (gameplay balance issue)
- **Player Experience**: Floors 3-4 feel empty and break immersion
- **Progression**: Players get free floors with no challenge
- **Playtesting**: Highly noticeable to playtesters

## Related Code Locations

### Floor Type Definition
```javascript
// Line 177
GHOST: 'ghost'
```

### Floor Type Determination
```javascript
// Line 995
if (floorNum <= 4) return FLOOR_TYPES.GHOST;
```

### Enemy Spawning Function
```javascript
// Function: _placeEnemies()
// Line: 2359-2396
```

## Suggested Implementation Approach

### Option 1: Simple Stationary "Cameras"
Add stationary camera enemies with extended vision but no movement:
```javascript
if (floorType === FLOOR_TYPES.GHOST) {
  // Spawn 2-3 stationary camera "enemies"
  for (var i = 0; i < 2 + Math.floor(_rng() * 2); i++) {
    var room = rooms[Math.floor(_rng() * rooms.length)];
    var x = room.x + Math.floor(_rng() * room.w);
    var y = room.y + Math.floor(_rng() * room.h);

    var camera = _createEnemy(x, y, 'STATIONARY', room);
    camera.isCamera = true;
    camera.emoji = '📹'; // Camera emoji
    camera.visionRange = 10; // Extended vision
    camera.canMove = false;

    _enemies.push(camera);
  }
  return;
}
```

### Option 2: Drone Patrol System
Add slow-moving drone enemies with patrol patterns:
```javascript
if (floorType === FLOOR_TYPES.GHOST) {
  // Spawn 1-2 patrol drones
  for (var i = 0; i < 1 + Math.floor(_rng() * 2); i++) {
    var room = rooms[Math.floor(_rng() * rooms.length)];
    var x = room.centerX;
    var y = room.centerY;

    var drone = _createEnemy(x, y, 'PATROL', room);
    drone.isDrone = true;
    drone.emoji = '🛸'; // Drone/UFO emoji
    drone.moveSpeed = 0.5; // Slower movement
    drone.detectionOnly = true; // No combat, just detection

    _enemies.push(drone);
  }
  return;
}
```

### Option 3: Hybrid System
Combine stationary cameras with 1 patrol drone for variety.

## Design Considerations

### Gameplay Balance
- Ghost floors should be **stealth-focused**
- Detection should trigger alarms, not immediate combat
- Should teach stealth mechanics for later floors

### Visual Clarity
- Use distinct emojis (📹 for cameras, 🛸 for drones)
- Different colors for surveillance vs combat enemies

### Difficulty Progression
- Floors 3-4 should be **slightly harder than tutorials**
- But not as hard as standard combat floors (5+)
- Focus on awareness/stealth rather than combat

## Testing Checklist

After implementation:
- [ ] Floors 3-4 spawn surveillance enemies
- [ ] Cameras have extended vision range
- [ ] Drones patrol correctly
- [ ] Detection mechanics work as intended
- [ ] Player can avoid detection through stealth
- [ ] Difficulty feels appropriate for early floors
- [ ] Visual representation is clear

## Files to Modify

1. **public/js/gone-rogue.js**
   - Update `_placeEnemies()` function (lines 2393-2395)
   - Add camera/drone enemy types if needed
   - Update enemy rendering to show distinct surveillance enemies

2. **PLAYTESTER_GUIDE.md**
   - Update floor table to reflect implemented system
   - Remove "Known Issue" warning for Ghost floors

## Priority
**Medium** - Not blocking but highly visible to playtesters

## Assigned To
To be determined

## Related Documentation
- Floor type system: README.txt lines 44-81
- Enemy AI: public/js/gone-rogue.js lines 2359+
- PLAYTESTER_GUIDE.md section on Floor Types

## Status
**Open** - Awaiting implementation

---

**Issue Created**: 2026-02-20
**Discovered During**: Code quality audit and playtester documentation preparation
