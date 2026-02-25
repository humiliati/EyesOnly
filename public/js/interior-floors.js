/* ============================================================
   Interior Floors Module (v0)
   Registry for authored interior layouts and procedural generators.
   ============================================================ */
var InteriorFloors = (function() {
  'use strict';
  var _authoredLayouts = {};
  var _generators = {};

  function registerAuthoredLayout(floorId, layoutDef) {
    if (!floorId || typeof floorId !== 'string') return;
    if (!layoutDef || typeof layoutDef !== 'object') return;
    _authoredLayouts[floorId] = layoutDef;
    console.log('[InteriorFloors] Registered authored layout: ' + floorId);
  }

  function getAuthoredLayout(floorId) {
    return _authoredLayouts[floorId] || null;
  }

  function registerGenerator(name, genFn) {
    if (!name || typeof name !== 'string') return;
    if (typeof genFn !== 'function') return;
    _generators[name] = genFn;
    console.log('[InteriorFloors] Registered generator: ' + name);
  }

  function generateProceduralInterior(name, config) {
    var genFn = _generators[name];
    if (!genFn) return null;
    try {
      var result = genFn(config || {});
      if (!result || !result.grid) return null;
      return result;
    } catch (e) {
      console.error('[InteriorFloors] Generator error:', e);
      return null;
    }
  }

  function isInteriorFloor(floorId) {
    return String(floorId).indexOf('.') !== -1;
  }

  function getParentFloorId(floorId) {
    var str = String(floorId);
    var lastDot = str.lastIndexOf('.');
    if (lastDot === -1) return null;
    return str.substring(0, lastDot);
  }

  function resolveNestedGen(targetFloorId) {
    if (typeof GoneRogueDataRegistry === 'undefined' || !GoneRogueDataRegistry.isLoaded()) return null;
    var buildings = GoneRogueDataRegistry.listBuildings();
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (!b || !Array.isArray(b.nested)) continue;
      for (var j = 0; j < b.nested.length; j++) {
        var n = b.nested[j];
        if (n && n.targetFloorId === targetFloorId && n.kind === 'procedural' && n.gen) {
          return {
            genName: n.gen,
            config: { width: 30, height: 15, difficulty: 1, parentBuildingId: b.id, nestedId: n.id, targetFloorId: targetFloorId },
            parentBuildingId: b.id
          };
        }
      }
    }
    return null;
  }

  function hasGenerator(name) { return !!_generators[name]; }
  function listAuthoredFloors() { return Object.keys(_authoredLayouts); }
  function listGenerators() { return Object.keys(_generators); }

  return {
    registerAuthoredLayout: registerAuthoredLayout,
    getAuthoredLayout: getAuthoredLayout,
    registerGenerator: registerGenerator,
    generateProceduralInterior: generateProceduralInterior,
    isInteriorFloor: isInteriorFloor,
    getParentFloorId: getParentFloorId,
    resolveNestedGen: resolveNestedGen,
    hasGenerator: hasGenerator,
    listAuthoredFloors: listAuthoredFloors,
    listGenerators: listGenerators
  };
})();
