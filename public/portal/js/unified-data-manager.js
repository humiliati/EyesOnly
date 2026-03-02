var UnifiedDataManager = (function() {
    'use strict';

    const assetRegistry = {};

    function registerAsset(asset) {
        assetRegistry[asset.id] = asset;
        console.log(`Asset registered: ${asset.id}`);
    }

    function getAsset(assetId) {
        return assetRegistry[assetId];
    }

    function getAllAssets() {
        return assetRegistry;
    }

    const floorRegistry = {};

    function registerFloor(floorData) {
        floorRegistry[floorData.name] = floorData;
        console.log(`Floor registered: ${floorData.name}`);
    }

    function getFloor(floorName) {
        return floorRegistry[floorName];
    }

    function getAllFloors() {
        return floorRegistry;
    }

    return {
        registerAsset: registerAsset,
        getAsset: getAsset,
        getAllAssets: getAllAssets,
        registerFloor: registerFloor,
        getFloor: getFloor,
        getAllFloors: getAllFloors
    };
})();
