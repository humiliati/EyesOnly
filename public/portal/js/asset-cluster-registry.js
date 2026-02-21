/* ============================================================
   EYES ONLY - Asset Cluster Registry
   Manages scene asset definitions with localStorage persistence
   ============================================================ */

const AssetClusterRegistry = (function() {
  'use strict';

  const STORAGE_KEY = 'eyesonly_asset_registry_v1';

  // Default asset templates
  var DEFAULT_ASSETS = {
    DESK_CLUSTER_OFFICE: {
      id: 'DESK_CLUSTER_OFFICE',
      name: 'Office Desk Cluster',
      description: 'Computer setup with coffee and supplies',
      category: 'furniture',
      emojiSet: [
        {
          emoji: '💻',
          offsetX: 0,
          offsetY: -6,
          scale: 0.85,
          layer: 'base',
          rotation: 0
        },
        {
          emoji: '☕',
          offsetX: 14,
          offsetY: 2,
          scale: 0.35,
          layer: 'surface',
          rotation: 0
        },
        {
          emoji: '📎',
          offsetX: -12,
          offsetY: 8,
          scale: 0.25,
          layer: 'surface',
          rotation: 0
        },
        {
          emoji: '📃',
          offsetX: 6,
          offsetY: -14,
          scale: 0.45,
          layer: 'floating',
          rotation: 0
        }
      ],
      anchor: {
        x: 0,
        y: 0,
        origin: 'center'
      },
      validTiles: ['FLOOR_OFFICE', 'FLOOR_CORRIDOR'],
      placementRules: {
        minSeparation: 3,
        maxPerRegion: 4,
        preferAgainstWall: false,
        avoidHighTraffic: true,
        seedModifier: 0
      },
      densityConfig: {
        baseDensity: 0.3,
        scatterChance: 0.4,
        maxClustersPerChunk: 8
      },
      renderConfig: {
        layers: [
          { name: 'base', zOffset: 0 },
          { name: 'surface', zOffset: 4 },
          { name: 'floating', zOffset: 8 }
        ],
        shadows: true,
        ambientOcclusion: true
      },
      animations: {
        onPlace: 'slideUp',
        onInteract: 'wiggle',
        onDestroy: 'shrinkFade'
      },
      tags: ['office', 'furniture', 'workstation'],
      author: 'system',
      version: '1.0.0',
      created: new Date().toISOString().split('T')[0],
      modified: new Date().toISOString().split('T')[0]
    },
    TREE_BASIC: {
      id: 'TREE_BASIC',
      name: 'Basic Tree',
      description: 'Simple tree with leaves',
      category: 'nature',
      emojiSet: [
        {
          emoji: '🌳',
          offsetX: 0,
          offsetY: 0,
          scale: 1.0,
          layer: 'base',
          rotation: 0
        }
      ],
      anchor: { x: 0, y: 0, origin: 'center' },
      validTiles: ['FLOOR_GRASS', 'FLOOR_FOREST'],
      placementRules: {
        minSeparation: 2,
        maxPerRegion: 6,
        preferAgainstWall: false,
        avoidHighTraffic: false,
        seedModifier: 0
      },
      densityConfig: {
        baseDensity: 0.4,
        scatterChance: 0.6,
        maxClustersPerChunk: 12
      },
      renderConfig: {
        layers: [{ name: 'base', zOffset: 0 }],
        shadows: true,
        ambientOcclusion: false
      },
      animations: {
        onPlace: 'pop',
        onInteract: 'none',
        onDestroy: 'fade'
      },
      tags: ['nature', 'tree'],
      author: 'system',
      version: '1.0.0',
      created: new Date().toISOString().split('T')[0],
      modified: new Date().toISOString().split('T')[0]
    }
  };

  /**
   * Get all assets from registry
   * @returns {Object} All assets
   */
  function getAll() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('[AssetRegistry] Error loading assets:', e);
    }
    return Object.assign({}, DEFAULT_ASSETS);
  }

  /**
   * Get a specific asset by ID
   * @param {string} id - Asset ID
   * @returns {Object|null} Asset definition
   */
  function get(id) {
    var assets = getAll();
    return assets[id] || null;
  }

  /**
   * Save an asset to registry
   * @param {Object} asset - Asset definition
   */
  function save(asset) {
    if (!asset || !asset.id) {
      throw new Error('Asset must have an id');
    }

    var assets = getAll();
    assets[asset.id] = asset;
    assets[asset.id].modified = new Date().toISOString().split('T')[0];

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
      console.log('[AssetRegistry] Saved asset:', asset.id);
      return true;
    } catch (e) {
      console.error('[AssetRegistry] Error saving asset:', e);
      return false;
    }
  }

  /**
   * Delete an asset from registry
   * @param {string} id - Asset ID
   */
  function remove(id) {
    var assets = getAll();
    if (assets[id]) {
      delete assets[id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
        console.log('[AssetRegistry] Deleted asset:', id);
        return true;
      } catch (e) {
        console.error('[AssetRegistry] Error deleting asset:', e);
        return false;
      }
    }
    return false;
  }

  /**
   * Get assets by category
   * @param {string} category - Category name
   * @returns {Array} Array of assets
   */
  function getByCategory(category) {
    var assets = getAll();
    return Object.values(assets).filter(function(asset) {
      return asset.category === category;
    });
  }

  /**
   * Export asset as JSON
   * @param {string} id - Asset ID
   * @returns {string} JSON string
   */
  function exportAsset(id) {
    var asset = get(id);
    if (asset) {
      return JSON.stringify(asset, null, 2);
    }
    return null;
  }

  /**
   * Import asset from JSON
   * @param {string} json - JSON string
   * @returns {boolean} Success
   */
  function importAsset(json) {
    try {
      var asset = JSON.parse(json);
      return save(asset);
    } catch (e) {
      console.error('[AssetRegistry] Error importing asset:', e);
      return false;
    }
  }

  /**
   * Reset to defaults
   */
  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[AssetRegistry] Reset to defaults');
      return true;
    } catch (e) {
      console.error('[AssetRegistry] Error resetting:', e);
      return false;
    }
  }

  /**
   * Create a new empty asset template
   * @param {string} id - Asset ID
   * @param {string} category - Category
   * @returns {Object} New asset template
   */
  function createTemplate(id, category) {
    return {
      id: id || 'NEW_ASSET_' + Date.now(),
      name: 'New Asset',
      description: '',
      category: category || 'furniture',
      emojiSet: [],
      anchor: { x: 0, y: 0, origin: 'center' },
      validTiles: ['FLOOR_OFFICE'],
      placementRules: {
        minSeparation: 3,
        maxPerRegion: 4,
        preferAgainstWall: false,
        avoidHighTraffic: false,
        seedModifier: 0
      },
      densityConfig: {
        baseDensity: 0.3,
        scatterChance: 0.4,
        maxClustersPerChunk: 8
      },
      renderConfig: {
        layers: [
          { name: 'base', zOffset: 0 },
          { name: 'surface', zOffset: 4 },
          { name: 'floating', zOffset: 8 }
        ],
        shadows: true,
        ambientOcclusion: true
      },
      animations: {
        onPlace: 'slideUp',
        onInteract: 'wiggle',
        onDestroy: 'shrinkFade'
      },
      tags: [],
      author: 'user',
      version: '1.0.0',
      created: new Date().toISOString().split('T')[0],
      modified: new Date().toISOString().split('T')[0]
    };
  }

  // Public API
  return {
    getAll: getAll,
    get: get,
    save: save,
    remove: remove,
    getByCategory: getByCategory,
    exportAsset: exportAsset,
    importAsset: importAsset,
    reset: reset,
    createTemplate: createTemplate,
    STORAGE_KEY: STORAGE_KEY
  };
})();

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetClusterRegistry;
}
