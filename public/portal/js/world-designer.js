(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        const worldCanvas = document.getElementById('world-canvas');
        const inspectorContent = document.getElementById('inspector-content');

        jsPlumb.ready(function() {
            const GRID_SIZE = 20;
            const instance = jsPlumb.getInstance({
                Container: worldCanvas,
                DragOptions: { cursor: 'pointer', zIndex: 2000, grid: [GRID_SIZE, GRID_SIZE] },
                ConnectionOverlays: [
                    [ 'Arrow', { location: 1, width: 10, length: 10, id: 'arrow' } ]
                ]
            });

            instance.bind('connection', (info) => {
                console.log('Connection established:', info.connection);
            });

            const worldSelector = document.getElementById('world-selector');

            function populateWorldSelector() {
                // This would be an API call in a real application
                const worlds = ['world.json']; // Assuming world.json exists
                worldSelector.innerHTML = '';
                worlds.forEach(world => {
                    const option = document.createElement('option');
                    option.value = world;
                    option.innerText = world;
                    worldSelector.appendChild(option);
                });
            }

            function loadSelectedWorld() {
                const worldFile = worldSelector.value;
                fetch(`world-engine/worlds/${worldFile}`)
                    .then(response => response.json())
                    .then(data => loadWorldData(data))
                    .catch(err => console.error('Error loading world:', err));
            }

            worldSelector.addEventListener('change', loadSelectedWorld);

            populateWorldSelector();

            const GridManager = {
                gridSize: 50,
                zoomLevel: 1,
                init: function() {
                    this.updateGrid();
                },
                updateGrid: function() {
                    const size = this.gridSize * this.zoomLevel;
                    worldCanvas.style.backgroundSize = `${size}px ${size}px`;
                },
                snapToGrid: function(pixelX, pixelY) {
                    const size = this.gridSize;
                    const gridX = Math.round(pixelX / size);
                    const gridY = Math.round(pixelY / size);
                    return { x: gridX * size, y: gridY * size };
                },
                setZoom: function(level) {
                    this.zoomLevel = Math.max(0.2, Math.min(level, 3)); // Clamp zoom level
                    this.updateGrid();
                    instance.setZoom(this.zoomLevel);
                }
            };

            GridManager.init();

            let nodeCounter = 0;

            // Drag and Drop
            document.querySelectorAll('.draggable-item').forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', e.target.dataset.itemType);
                });
            });

            worldCanvas.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            worldCanvas.addEventListener('drop', (e) => {
                e.preventDefault();
                const itemType = e.dataTransfer.getData('text/plain');
                
                // Correctly calculate canvas-relative coordinates
                const canvasRect = worldCanvas.getBoundingClientRect();
                const dropX = e.clientX - canvasRect.left;
                const dropY = e.clientY - canvasRect.top;

                // Account for jsPlumb zoom
                const zoomedX = dropX / instance.getZoom();
                const zoomedY = dropY / instance.getZoom();

                const pos = snapToGrid ? GridManager.snapToGrid(zoomedX, zoomedY) : { x: zoomedX, y: zoomedY };
                addBlock(itemType, pos.x, pos.y);
            });

            function addBlock(type, x, y) {
                const id = `${type}-${nodeCounter++}`;
                const block = document.createElement('div');
                block.className = 'world-node';
                block.id = id;
                block.style.left = `${x}px`;
                block.style.top = `${y}px`;
                block.dataset.type = type;

                let doorCount = 0;
                let gridWidth = 2;
                let gridHeight = 1;

                switch (type) {
                    // Floors
                    case 'floor-0':
                        block.classList.add('floor-0-color');
                        block.innerHTML = `<strong>Start Floor</strong>`;
                        doorCount = 1;
                        break;
                    case 'floor':
                        block.classList.add('floor-color');
                        block.innerHTML = `<strong>Floor</strong>`;
                        doorCount = 2;
                        break;
                    case 'bonfire':
                        block.classList.add('bonfire-color');
                        block.innerHTML = `<strong>Bonfire</strong>`;
                        doorCount = 2;
                        break;
                    case 'vents':
                        block.classList.add('vents-color');
                        block.innerHTML = `<strong>Vents</strong>`;
                        doorCount = 2;
                        break;
                    case 'boss':
                        block.classList.add('boss-color');
                        block.innerHTML = `<strong>Boss</strong>`;
                        doorCount = 1;
                        break;
                    case 'floor-999':
                        block.classList.add('floor-999-color');
                        block.innerHTML = `<strong>End Floor</strong>`;
                        doorCount = 1;
                        break;

                    // Buildings
                    case 'BuildingSimple':
                        block.classList.add('building-simple-color');
                        block.innerHTML = `<strong>Simple Building</strong>`;
                        block.dataset.nestedInteriors = 0;
                        doorCount = 1;
                        break;
                    case 'BuildingVertical':
                        block.classList.add('building-vertical-color');
                        block.innerHTML = `<strong>Vertical Building</strong>`;
                        block.dataset.nestedInteriors = 0;
                        doorCount = 1;
                        break;
                    case 'BuildingHorizontal':
                        block.classList.add('building-horizontal-color');
                        block.innerHTML = `<strong>Horizontal Building</strong>`;
                        block.dataset.nestedInteriors = 0;
                        doorCount = 1;
                        break;
                }

                block.style.width = `${GridManager.gridSize * gridWidth}px`;
                block.style.height = `${GridManager.gridSize * gridHeight}px`;

                // Add doors
                for (let i = 0; i < doorCount; i++) {
                    const door = document.createElement('div');
                    door.className = 'door';
                    // Simple positioning for now, can be improved
                    door.style.left = `${(i * 100 / (doorCount || 1))}px`;
                    block.appendChild(door);
                }

                worldCanvas.appendChild(block);
                instance.draggable(id, {
                    grid: [GridManager.gridSize, GridManager.gridSize],
                    drag: (e) => {
                        if (e.el.classList.contains('selected')) {
                            const selected = document.querySelectorAll('.selected');
                            selected.forEach(node => {
                                if (node.id !== e.el.id) {
                                    const style = window.getComputedStyle(node);
                                    const x = parseInt(style.getPropertyValue('left'), 10);
                                    const y = parseInt(style.getPropertyValue('top'), 10);
                                    node.style.left = `${x + e.e.movementX}px`;
                                    node.style.top = `${y + e.e.movementY}px`;
                                    instance.revalidate(node.id);
                                }
                            });
                        }
                    }
                });

                const doors = block.querySelectorAll('.door');
                doors.forEach((door) => {
                    instance.addEndpoint(door, { anchor: 'Center', isSource: true, isTarget: true });
                });
            }

            worldCanvas.addEventListener('click', (e) => {
                if (e.target.classList.contains('world-node')) {
                    if (!e.ctrlKey && !e.metaKey) {
                        clearInspector();
                    }

                    if (e.target.classList.contains('selected')) {
                        e.target.classList.remove('selected');
                    } else {
                        e.target.classList.add('selected');
                    }

                    const selectedNodes = document.querySelectorAll('.selected');
                    if (selectedNodes.length > 0) {
                        showInspector(selectedNodes[0]); // For now, show inspector for the first selected item
                    } else {
                        clearInspector();
                    }

                } else if (e.target.classList.contains('door')) {
                    // Do nothing, let jsPlumb handle it
                } else if (e.target.closest('.world-node')) {
                    const parent = e.target.closest('.world-node');
                    if (parent.classList.contains('selected')) {
                        addNodeButton(parent, e.clientX - parent.getBoundingClientRect().left, e.clientY - parent.getBoundingClientRect().top);
                    }
                } else {
                    clearInspector();
                }
            });

            function addNodeButton(parent, x, y) {
                const button = document.createElement('button');
                button.className = 'node-button';
                button.style.left = `${x}px`;
                button.style.top = `${y}px`;
                parent.appendChild(button);

                instance.addEndpoint(button, {
                    anchor: 'Center',
                    isSource: true,
                    isTarget: true
                });

                button.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent the parent from being selected
                    document.querySelectorAll('.node-button').forEach(b => b.classList.remove('selected'));
                    button.classList.add('selected');
                    showInspector(button);
                });
            }

            // Function to show the property inspector
            function showInspector(element) {
                let id, type, name, content;
                const propertiesTab = document.getElementById('properties-tab');
                const notesTextarea = document.getElementById('node-notes');

                if (element.classList.contains('world-node')) {
                    id = element.id;
                    type = element.dataset.type;
                    name = element.querySelector('strong').innerText;

                    content = `
                        <div><strong>ID:</strong> ${id}</div>
                        <div><strong>Type:</strong> ${type}</div>
                        <div><label><strong>Name:</strong> <input type="text" id="prop-name" value="${name}"></label></div>
                    `;

                    if (type.includes('Building')) {
                        content += `<button id="add-interior-btn">Add Interior</button>`;
                    } else if (type === 'bonfire') {
                        content += `<div><label><strong>Bonfire Type:</strong> <select id="prop-bonfire-type"><option>Healing</option><option>Resource</option><option>Shop</option><option>Save Point</option></select></label></div>`;
                    }
                } else if (element.classList.contains('node-button')) {
                    id = element.parentElement.id + '-' + Array.from(element.parentElement.querySelectorAll('.node-button')).indexOf(element);
                    type = 'Node Button';
                    content = `<div><strong>ID:</strong> ${id}</div><div><strong>Type:</strong> ${type}</div>`;
                }

                propertiesTab.innerHTML = content;
                notesTextarea.value = element.dataset.notes || '';
                document.getElementById('delete-btn').style.display = 'block';

                // Add event listeners for the new properties
                if (element.classList.contains('world-node')) {
                    const nameInput = document.getElementById('prop-name');
                    if (nameInput) {
                        nameInput.addEventListener('input', (e) => {
                            element.querySelector('strong').innerText = e.target.value;
                        });
                    }

                    if (element.dataset.type.includes('Building')) {
                        const addInteriorBtn = document.getElementById('add-interior-btn');
                        if (addInteriorBtn) {
                            addInteriorBtn.addEventListener('click', () => {
                                let nestedInteriors = parseInt(element.dataset.nestedInteriors || '0');
                                nestedInteriors++;
                                element.dataset.nestedInteriors = nestedInteriors;
                                element.style.width = `${GridManager.gridSize * (2 + nestedInteriors)}px`;
                                instance.revalidate(element.id);
                            });
                        }
                    } else if (element.dataset.type === 'bonfire') {
                        const bonfireTypeSelect = document.getElementById('prop-bonfire-type');
                        if (bonfireTypeSelect) {
                            bonfireTypeSelect.value = element.dataset.bonfireType || 'Healing';
                            bonfireTypeSelect.addEventListener('change', (e) => {
                                element.dataset.bonfireType = e.target.value;
                            });
                        }
                    }
                }

                notesTextarea.oninput = (e) => {
                    element.dataset.notes = e.target.value;
                };
            }

            document.getElementById('delete-btn').addEventListener('click', () => {
                const selected = document.querySelector('.selected');
                if (selected) {
                    if (selected.classList.contains('node-button')) {
                        selected.remove();
                    } else {
                        instance.remove(selected);
                    }
                    clearInspector();
                }
            });

            function clearInspector() {
                document.getElementById('properties-tab').innerHTML = '<div class="inspector-empty"><p>Select an element to view properties</p></div>';
                document.getElementById('node-notes').value = '';
                document.getElementById('delete-btn').style.display = 'none';
                document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            }

            // Tab functionality
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabId = btn.dataset.tab;
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    document.getElementById(`${tabId}-tab`).classList.add('active');
                });
            });

            // Zoom
            document.getElementById('zoom-in-btn').addEventListener('click', () => {
                GridManager.setZoom(GridManager.zoomLevel + 0.1);
            });
            document.getElementById('zoom-out-btn').addEventListener('click', () => {
                GridManager.setZoom(GridManager.zoomLevel - 0.1);
            });

            let isPanning = false;
            let panStart = { x: 0, y: 0 };

            const panToolBtn = document.getElementById('pan-tool-btn');
            panToolBtn.addEventListener('click', () => {
                isPanning = !isPanning;
                panToolBtn.classList.toggle('active', isPanning);
                worldCanvas.classList.toggle('panning', isPanning);
            });

            worldCanvas.addEventListener('mousedown', (e) => {
                if (isPanning) {
                    panStart.x = e.clientX;
                    panStart.y = e.clientY;
                    return;
                }

                if (e.target === worldCanvas) {
                    isMarqueeSelecting = true;
                    marquee.style.display = 'block';
                    marqueeStart.x = e.clientX;
                    marqueeStart.y = e.clientY;
                }
            });

            worldCanvas.addEventListener('mousemove', (e) => {
                if (isMarqueeSelecting) {
                    const x = Math.min(e.clientX, marqueeStart.x);
                    const y = Math.min(e.clientY, marqueeStart.y);
                    const width = Math.abs(e.clientX - marqueeStart.x);
                    const height = Math.abs(e.clientY - marqueeStart.y);
                    marquee.style.left = `${x}px`;
                    marquee.style.top = `${y}px`;
                    marquee.style.width = `${width}px`;
                    marquee.style.height = `${height}px`;
                }
            });

            worldCanvas.addEventListener('mouseup', (e) => {
                if (isMarqueeSelecting) {
                    isMarqueeSelecting = false;
                    marquee.style.display = 'none';

                    const marqueeRect = marquee.getBoundingClientRect();
                    const newSelection = [];
                    document.querySelectorAll('.world-node').forEach(node => {
                        const nodeRect = node.getBoundingClientRect();
                        if (rectsIntersect(marqueeRect, nodeRect)) {
                            newSelection.push(node);
                        }
                    });

                    if (!e.ctrlKey && !e.metaKey) {
                        clearInspector();
                    }

                    newSelection.forEach(node => {
                        if (!node.classList.contains('selected')) {
                            node.classList.add('selected');
                        }
                    });

                    if (newSelection.length > 0) {
                        showInspector(newSelection[0]); // For now, show inspector for the first selected item
                    }
                }
            });

            function rectsIntersect(r1, r2) {
                return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
            }

            let isMarqueeSelecting = false;
            const marquee = document.getElementById('selection-marquee');
            const marqueeStart = { x: 0, y: 0 };

            worldCanvas.addEventListener('mousemove', (e) => {
                if (isPanning && e.buttons === 1) {
                    const dx = e.clientX - panStart.x;
                    const dy = e.clientY - panStart.y;

                    const currentX = parseInt(worldCanvas.style.backgroundPositionX || 0);
                    const currentY = parseInt(worldCanvas.style.backgroundPositionY || 0);

                    worldCanvas.style.backgroundPositionX = `${currentX + dx}px`;
                    worldCanvas.style.backgroundPositionY = `${currentY + dy}px`;

                    instance.repaintEverything();
                    panStart.x = e.clientX;
                    panStart.y = e.clientY;
                }
            });

            let gridVisible = true;
            const gridToggleBtn = document.getElementById('grid-toggle-btn');
            gridToggleBtn.addEventListener('click', () => {
                gridVisible = !gridVisible;
                worldCanvas.style.backgroundImage = gridVisible ? '' : 'none';
                gridToggleBtn.classList.toggle('active', gridVisible);
            });

            let snapToGrid = true;
            const snapToggleBtn = document.getElementById('snap-toggle-btn');
            snapToggleBtn.addEventListener('click', () => {
                snapToGrid = !snapToGrid;
                snapToggleBtn.classList.toggle('active', snapToGrid);
            });


        });

        function exportWorld() {
            const nodes = instance.getManagedElements();
            const connections = instance.getAllConnections();

            const worldData = {
                nodes: [],
                connections: []
            };

            for (const id in nodes) {
                const el = nodes[id].el;
                worldData.nodes.push({
                    id: el.id,
                    name: el.innerText,
                    top: el.style.top,
                    left: el.style.left,
                    type: el.dataset.type,
                    biome: el.dataset.biome,
                    generationType: el.dataset.generationType
                });
            }

            connections.forEach(conn => {
                worldData.connections.push({
                    from: conn.sourceId,
                    to: conn.targetId
                });
            });

            const json = JSON.stringify(worldData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'world.json';
            a.click();
            URL.revokeObjectURL(url);
        }

        function importWorld(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const worldData = JSON.parse(event.target.result);
                    loadWorldData(worldData);
                } catch (err) {
                    alert('Error importing world: ' + err.message);
                }
            };
            reader.readAsText(file);
        }

        function loadWorldData(worldData) {
            // Clear existing world
            instance.deleteEveryEndpoint();
            worldCanvas.innerHTML = '';

            // Create nodes
            worldData.nodes.forEach(nodeData => {
                const node = addNode(nodeData.type, nodeData.name, parseInt(nodeData.top), parseInt(nodeData.left));
                node.id = nodeData.id;
                node.dataset.biome = nodeData.biome;
                node.dataset.generationType = nodeData.generationType;
            });

            // Create connections
            worldData.connections.forEach(connData => {
                instance.connect({
                    source: connData.from,
                    target: connData.to
                });
            });
        }
    });
})();
