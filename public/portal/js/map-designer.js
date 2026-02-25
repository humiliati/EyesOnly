(function() {
    'use strict';

    // ==================== CONSTANTS ====================
    const GRID_WIDTH = 40;
    const GRID_HEIGHT = 20;
    const CELL_SIZE = 20;
    const TILE_COLORS = {
        '.': '#1a1a1a',  // Floor
        '#': '#444',     // Wall
        '~': '#1a3a5c'   // Water
    };

    // ==================== STATE ====================
    const state = {
        grid: [],
        entities: [],
        playerSpawn: null,
        exitPos: null,
        selectedTool: 'floor',
        selectedEntity: null,
        selectedEntityId: null,
        brushSize: 1,
        zoom: 1,
        isMouseDown: false,
        lastMousePos: { x: 0, y: 0 },
        showGrid: true,
        floorName: 'Untitled',
        floorNumber: 1
    };

    // ==================== DOM REFERENCES ====================
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    const brushSizeInput = document.getElementById('brush-size');
    const brushSizeDisplay = document.getElementById('brush-size-display');
    const cursorPosDisplay = document.getElementById('cursor-pos');
    const floorNameInput = document.getElementById('floor-name');
    const floorNumberInput = document.getElementById('floor-number');
    const showGridCheckbox = document.getElementById('show-grid');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const floorSelector = document.getElementById('floor-selector');
    const loadBtn = document.getElementById('load-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFileInput = document.getElementById('import-file');
    const applyPropsBtn = document.getElementById('apply-props');
    const deleteEntityBtn = document.getElementById('delete-entity');
    const inspectorContent = document.getElementById('inspector-content');

    // ==================== INITIALIZATION ====================
    function initGrid() {
        state.grid = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                // Create border
                if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) {
                    row.push('#');
                } else {
                    row.push('.');
                }
            }
            state.grid.push(row);
        }
    }

    function init() {
        initGrid();
        state.entities = [];
        state.playerSpawn = null;
        state.exitPos = null;
        state.selectedTool = 'floor';
        state.selectedEntity = null;
        state.selectedEntityId = null;

        setupEventListeners();
        render();
    }

    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        // Palette buttons
        document.querySelectorAll('.palette-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.target.getAttribute('data-tool');
                selectTool(tool);
            });
        });

        // Brush size
        brushSizeInput.addEventListener('change', (e) => {
            state.brushSize = parseInt(e.target.value);
            brushSizeDisplay.textContent = state.brushSize;
        });

        // Canvas events
        canvas.addEventListener('mousedown', onCanvasMouseDown);
        canvas.addEventListener('mousemove', onCanvasMouseMove);
        canvas.addEventListener('mouseup', onCanvasMouseUp);
        canvas.addEventListener('mouseleave', onCanvasMouseLeave);

        // Floor info
        floorNameInput.addEventListener('change', (e) => {
            state.floorName = e.target.value;
        });

        floorNumberInput.addEventListener('change', (e) => {
            state.floorNumber = parseInt(e.target.value);
        });

        // Grid and zoom
        showGridCheckbox.addEventListener('change', (e) => {
            state.showGrid = e.target.checked;
            render();
        });

        zoomInBtn.addEventListener('click', () => {
            state.zoom = Math.min(state.zoom + 0.2, 3);
            canvas.width = GRID_WIDTH * CELL_SIZE * state.zoom;
            canvas.height = GRID_HEIGHT * CELL_SIZE * state.zoom;
            render();
        });

        zoomOutBtn.addEventListener('click', () => {
            state.zoom = Math.max(state.zoom - 0.2, 0.5);
            canvas.width = GRID_WIDTH * CELL_SIZE * state.zoom;
            canvas.height = GRID_HEIGHT * CELL_SIZE * state.zoom;
            render();
        });

        // Floor selector
        floorSelector.addEventListener('change', loadFloorBySelector);

        // Load, Export, Import
        loadBtn.addEventListener('click', showLoadDialog);
        exportBtn.addEventListener('click', exportFloor);
        importBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', importFloor);

        // Inspector controls
        applyPropsBtn.addEventListener('click', applyEntityProperties);
        deleteEntityBtn.addEventListener('click', deleteSelectedEntity);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
    }

    // ==================== TOOL SELECTION ====================
    function selectTool(tool) {
        state.selectedTool = tool;
        state.selectedEntity = null;
        state.selectedEntityId = null;

        // Update button active state
        document.querySelectorAll('.palette-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

        // Clear inspector
        clearInspector();
        render();
    }

    // ==================== CANVAS EVENTS ====================
    function onCanvasMouseDown(e) {
        state.isMouseDown = true;
        const pos = getCanvasMousePos(e);
        handleToolAction(pos);
    }

    function onCanvasMouseMove(e) {
        const pos = getCanvasMousePos(e);
        updateCursorDisplay(pos);

        if (state.isMouseDown) {
            handleToolAction(pos);
        }
    }

    function onCanvasMouseUp(e) {
        state.isMouseDown = false;
    }

    function onCanvasMouseLeave(e) {
        state.isMouseDown = false;
    }

    function getCanvasMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / (CELL_SIZE * state.zoom));
        const y = Math.floor((e.clientY - rect.top) / (CELL_SIZE * state.zoom));
        return { x: Math.max(0, Math.min(x, GRID_WIDTH - 1)), y: Math.max(0, Math.min(y, GRID_HEIGHT - 1)) };
    }

    function updateCursorDisplay(pos) {
        cursorPosDisplay.textContent = `X: ${pos.x} Y: ${pos.y}`;
        state.lastMousePos = pos;
    }

    function handleToolAction(pos) {
        const isTerrain = ['floor', 'wall', 'water', 'eraser'].includes(state.selectedTool);
        const isEntity = ['player', 'enemy', 'npc', 'breakable', 'currency', 'decoration', 'building', 'door-forward', 'door-back', 'door-building'].includes(state.selectedTool);

        if (isTerrain) {
            applyTerrainBrush(pos);
        } else if (isEntity) {
            placeOrSelectEntity(pos);
        }
    }

    // ==================== TERRAIN TOOLS ====================
    function applyTerrainBrush(pos) {
        const brush = state.brushSize;
        let tileChar = '.';

        switch (state.selectedTool) {
            case 'floor': tileChar = '.'; break;
            case 'wall': tileChar = '#'; break;
            case 'water': tileChar = '~'; break;
            case 'eraser': tileChar = '.'; break;
        }

        for (let dy = -brush + 1; dy < brush; dy++) {
            for (let dx = -brush + 1; dx < brush; dx++) {
                const nx = pos.x + dx;
                const ny = pos.y + dy;
                if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                    state.grid[ny][nx] = tileChar;
                }
            }
        }

        render();
    }

    // ==================== ENTITY TOOLS ====================
    function placeOrSelectEntity(pos) {
        // Check if clicking on existing entity
        const existingEntity = state.entities.find(e => e.x === pos.x && e.y === pos.y);

        if (existingEntity) {
            selectEntity(existingEntity);
        } else {
            // Place new entity
            const newEntity = createEntity(state.selectedTool, pos);
            if (newEntity) {
                state.entities.push(newEntity);
                selectEntity(newEntity);
                render();
            }
        }
    }

    function createEntity(type, pos) {
        const id = 'entity_' + Date.now();
        const baseEntity = {
            id,
            type,
            x: pos.x,
            y: pos.y,
            emoji: getEmojiForType(type),
            name: type.toUpperCase()
        };

        switch (type) {
            case 'player':
                state.playerSpawn = { x: pos.x, y: pos.y };
                return { ...baseEntity, name: 'Player' };
            case 'enemy':
                return {
                    ...baseEntity,
                    name: 'Enemy',
                    hp: 10,
                    attack: 3,
                    defense: 1,
                    sightRange: 5,
                    patrolPath: []
                };
            case 'npc':
                return {
                    ...baseEntity,
                    name: 'NPC',
                    direction: 'down',
                    dialogues: ['Hello!']
                };
            case 'breakable':
                return {
                    ...baseEntity,
                    name: 'Breakable',
                    hp: 5,
                    currencyDrop: 10,
                    cardDrops: []
                };
            case 'currency':
                return {
                    ...baseEntity,
                    name: 'Currency',
                    amount: 10
                };
            case 'decoration':
                return { ...baseEntity, name: 'Decoration' };
            case 'building':
                return {
                    ...baseEntity,
                    name: 'Building',
                    buildingId: 'building_1'
                };
            case 'door-forward':
                return {
                    ...baseEntity,
                    name: 'Door (Forward)',
                    targetFloor: 'floor2',
                    targetX: 20,
                    targetY: 10
                };
            case 'door-back':
                return {
                    ...baseEntity,
                    name: 'Door (Back)',
                    targetFloor: 'floor1',
                    targetX: 20,
                    targetY: 10
                };
            case 'door-building':
                return {
                    ...baseEntity,
                    name: 'Door (Building)',
                    buildingId: 'building_1',
                    targetX: 5,
                    targetY: 5
                };
            default:
                return baseEntity;
        }
    }

    function getEmojiForType(type) {
        const emojiMap = {
            'player': '👤',
            'enemy': '👹',
            'npc': '🧙',
            'breakable': '📦',
            'currency': '💰',
            'decoration': '🪴',
            'building': '🏠',
            'door-forward': '→',
            'door-back': '←',
            'door-building': 'B'
        };
        return emojiMap[type] || '?';
    }

    function selectEntity(entity) {
        state.selectedEntity = entity;
        state.selectedEntityId = entity.id;
        showInspector(entity);
        render();
    }

    // ==================== INSPECTOR ====================
    function showInspector(entity) {
        inspectorContent.innerHTML = '';
        applyPropsBtn.style.display = 'inline-block';
        deleteEntityBtn.style.display = 'inline-block';

        const fields = createPropertyFields(entity);
        fields.forEach(field => {
            inspectorContent.appendChild(field);
        });
    }

    function createPropertyFields(entity) {
        const fields = [];

        // Common fields
        const typeField = createField('text', 'Type', 'entity_type', entity.type);
        typeField.input.disabled = true;
        fields.push(typeField.element);

        fields.push(createField('text', 'Name', 'entity_name', entity.name).element);

        const emojiField = createField('text', 'Emoji', 'entity_emoji', entity.emoji);
        emojiField.input.maxLength = 1;
        fields.push(emojiField.element);

        // Type-specific fields
        switch (entity.type) {
            case 'enemy':
                fields.push(createField('number', 'HP', 'entity_hp', entity.hp).element);
                fields.push(createField('number', 'Attack', 'entity_attack', entity.attack).element);
                fields.push(createField('number', 'Defense', 'entity_defense', entity.defense).element);
                fields.push(createField('number', 'Sight Range', 'entity_sight', entity.sightRange).element);
                break;
            case 'breakable':
                fields.push(createField('number', 'HP', 'entity_hp', entity.hp).element);
                fields.push(createField('number', 'Currency Drop', 'entity_currency', entity.currencyDrop).element);
                break;
            case 'npc':
                fields.push(createField('text', 'Direction', 'entity_direction', entity.direction).element);
                fields.push(createField('text', 'Dialogue', 'entity_dialogue', entity.dialogues[0] || '').element);
                break;
            case 'currency':
                fields.push(createField('number', 'Amount', 'entity_amount', entity.amount).element);
                break;
            case 'building':
                fields.push(createField('text', 'Building ID', 'entity_building_id', entity.buildingId).element);
                break;
            case 'door-forward':
            case 'door-back':
            case 'door-building':
                fields.push(createField('text', 'Target Floor', 'entity_target_floor', entity.targetFloor || '').element);
                fields.push(createField('number', 'Target X', 'entity_target_x', entity.targetX || 0).element);
                fields.push(createField('number', 'Target Y', 'entity_target_y', entity.targetY || 0).element);
                if (entity.type === 'door-building') {
                    fields.push(createField('text', 'Building ID', 'entity_building_id', entity.buildingId || '').element);
                }
                break;
        }

        return fields;
    }

    function createField(type, label, id, value) {
        const div = document.createElement('div');
        div.className = 'property-field';

        const labelEl = document.createElement('label');
        labelEl.htmlFor = id;
        labelEl.textContent = label;

        let input;
        if (type === 'textarea') {
            input = document.createElement('textarea');
        } else {
            input = document.createElement('input');
            input.type = type;
        }
        input.id = id;
        input.value = value;

        div.appendChild(labelEl);
        div.appendChild(input);

        return { element: div, input };
    }

    function applyEntityProperties() {
        if (!state.selectedEntity) return;

        const entity = state.selectedEntity;

        entity.name = document.getElementById('entity_name')?.value || entity.name;
        entity.emoji = document.getElementById('entity_emoji')?.value || entity.emoji;

        switch (entity.type) {
            case 'enemy':
                entity.hp = parseInt(document.getElementById('entity_hp')?.value || entity.hp);
                entity.attack = parseInt(document.getElementById('entity_attack')?.value || entity.attack);
                entity.defense = parseInt(document.getElementById('entity_defense')?.value || entity.defense);
                entity.sightRange = parseInt(document.getElementById('entity_sight')?.value || entity.sightRange);
                break;
            case 'breakable':
                entity.hp = parseInt(document.getElementById('entity_hp')?.value || entity.hp);
                entity.currencyDrop = parseInt(document.getElementById('entity_currency')?.value || entity.currencyDrop);
                break;
            case 'npc':
                entity.direction = document.getElementById('entity_direction')?.value || entity.direction;
                entity.dialogues[0] = document.getElementById('entity_dialogue')?.value || entity.dialogues[0];
                break;
            case 'currency':
                entity.amount = parseInt(document.getElementById('entity_amount')?.value || entity.amount);
                break;
            case 'building':
                entity.buildingId = document.getElementById('entity_building_id')?.value || entity.buildingId;
                break;
            case 'door-forward':
            case 'door-back':
            case 'door-building':
                entity.targetFloor = document.getElementById('entity_target_floor')?.value || entity.targetFloor;
                entity.targetX = parseInt(document.getElementById('entity_target_x')?.value || entity.targetX);
                entity.targetY = parseInt(document.getElementById('entity_target_y')?.value || entity.targetY);
                if (entity.type === 'door-building') {
                    entity.buildingId = document.getElementById('entity_building_id')?.value || entity.buildingId;
                }
                break;
        }

        render();
    }

    function deleteSelectedEntity() {
        if (!state.selectedEntityId) return;

        state.entities = state.entities.filter(e => e.id !== state.selectedEntityId);
        state.selectedEntity = null;
        state.selectedEntityId = null;

        clearInspector();
        render();
    }

    function clearInspector() {
        inspectorContent.innerHTML = '<div class="inspector-empty"><p>Select an entity to view properties</p></div>';
        applyPropsBtn.style.display = 'none';
        deleteEntityBtn.style.display = 'none';
    }

    // ==================== RENDERING ====================
    function render() {
        const cellSize = CELL_SIZE * state.zoom;
        const width = GRID_WIDTH * cellSize;
        const height = GRID_HEIGHT * cellSize;

        canvas.width = width;
        canvas.height = height;

        // Draw tiles
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tile = state.grid[y][x];
                const color = TILE_COLORS[tile] || '#1a1a1a';

                ctx.fillStyle = color;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // Draw grid
        if (state.showGrid) {
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            for (let x = 0; x <= GRID_WIDTH; x++) {
                ctx.beginPath();
                ctx.moveTo(x * cellSize, 0);
                ctx.lineTo(x * cellSize, height);
                ctx.stroke();
            }
            for (let y = 0; y <= GRID_HEIGHT; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * cellSize);
                ctx.lineTo(width, y * cellSize);
                ctx.stroke();
            }
        }

        // Draw entities
        ctx.font = Math.max(12, cellSize - 4) + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        state.entities.forEach(entity => {
            ctx.fillText(
                entity.emoji,
                (entity.x + 0.5) * cellSize,
                (entity.y + 0.5) * cellSize
            );
        });

        // Draw selection highlight
        if (state.selectedEntity) {
            const e = state.selectedEntity;
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(e.x * cellSize, e.y * cellSize, cellSize, cellSize);
        }
    }

    // ==================== FILE OPERATIONS ====================
    function exportFloor() {
        const floorData = {
            name: state.floorName,
            number: state.floorNumber,
            width: GRID_WIDTH,
            height: GRID_HEIGHT,
            grid: state.grid,
            entities: state.entities,
            playerSpawn: state.playerSpawn,
            exitPos: state.exitPos
        };

        const json = JSON.stringify(floorData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (state.floorName || 'floor') + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importFloor(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const floorData = JSON.parse(event.target.result);
                loadFloorData(floorData);
            } catch (err) {
                alert('Error importing floor: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    function loadFloorData(floorData) {
        state.grid = floorData.grid || state.grid;
        state.entities = floorData.entities || [];
        state.playerSpawn = floorData.playerSpawn || null;
        state.exitPos = floorData.exitPos || null;
        state.floorName = floorData.name || 'Untitled';
        state.floorNumber = floorData.number || 1;

        floorNameInput.value = state.floorName;
        floorNumberInput.value = state.floorNumber;

        clearInspector();
        render();
    }

    function loadFloorBySelector() {
        const value = floorSelector.value;
        if (!window.TutorialFloors) {
            alert('TutorialFloors module not loaded');
            return;
        }

        let floorData = null;

        switch (value) {
            case 'floor1':
                floorData = window.TutorialFloors?.getFloor?.(1);
                break;
            case 'floor2':
                floorData = window.TutorialFloors?.getFloor?.(2);
                break;
            case 'floor3':
                floorData = window.TutorialFloors?.getFloor?.(3);
                break;
            case 'new':
                init();
                return;
        }

        if (floorData) {
            loadFloorData(floorData);
        }
    }

    function showLoadDialog() {
        alert('Load functionality would open a floor selection dialog');
    }

    // ==================== KEYBOARD SHORTCUTS ====================
    function handleKeyboardShortcuts(e) {
        switch (e.key.toLowerCase()) {
            case '1':
                selectTool('floor');
                break;
            case '2':
                selectTool('wall');
                break;
            case '3':
                selectTool('water');
                break;
            case '4':
                selectTool('eraser');
                break;
            case 'e':
                selectTool('enemy');
                break;
            case 'n':
                selectTool('npc');
                break;
            case 'b':
                selectTool('breakable');
                break;
            case 'Delete':
            case 'Backspace':
                if (state.selectedEntity) {
                    deleteSelectedEntity();
                }
                break;
        }
    }

    // ==================== INITIALIZATION ====================
    window.addEventListener('load', init);

})();
