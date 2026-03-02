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
                instance.bind('connection', (info) => {
                console.log('Connection established:', info.connection);
            });
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
                    const size = this.gridSize * this.zoomLevel;
                    const gridX = Math.round(pixelX / size);
                    const gridY = Math.round(pixelY / size);
                    return { x: gridX * size, y: gridY * size };
                },
                setZoom: function(level) {
                    this.zoomLevel = level;
                    this.updateGrid();
                }
            };

            GridManager.init();

            let nodeCounter = 0;
            let floorCounter = 0;

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
                const pos = GridManager.snapToGrid(e.clientX - worldCanvas.getBoundingClientRect().left, e.clientY - worldCanvas.getBoundingClientRect().top);
                addBlock(itemType, pos.x, pos.y);
            });

            function addBlock(type, x, y) {
                const id = `${type}-${nodeCounter++}`;
                const block = document.createElement('div');
                block.className = 'world-node'; // Re-using for now
                block.id = id;
                block.style.left = `${x}px`;
                block.style.top = `${y}px`;
                block.dataset.type = type;

                if (type === 'floor') {
                    block.style.width = `${GridManager.gridSize * 2}px`;
                    block.style.height = `${GridManager.gridSize}px`;
                    block.innerHTML = `<strong>Floor ${floorCounter++}</strong>`;

                    // Add doors
                    const door1 = document.createElement('div');
                    door1.className = 'door';
                    block.appendChild(door1);

                    if (floorCounter > 1) {
                        const door2 = document.createElement('div');
                        door2.className = 'door';
                        door2.style.left = 'calc(100% - 10px)';
                        block.appendChild(door2);
                    }
                } else if (type === 'building') {
                    block.style.width = `${GridManager.gridSize * 2}px`;
                    block.style.height = `${GridManager.gridSize}px`;
                    block.innerHTML = `<strong>Building</strong>`;
                }

                worldCanvas.appendChild(block);
                instance.draggable(id);

                if (type === 'floor') {
                    const doors = block.querySelectorAll('.door');
                    doors.forEach((door, index) => {
                        instance.addEndpoint(door, {
                            anchor: 'Center',
                            isSource: true,
                            isTarget: true
                        });
                    });
                }
            }

            worldCanvas.addEventListener('click', (e) => {
                if (e.target.classList.contains('world-node')) {
                    document.querySelectorAll('.world-node').forEach(n => n.classList.remove('selected'));
                    e.target.classList.add('selected');
                    showInspector(e.target);
                } else if (e.target.classList.contains('door')) {
                    // Do nothing, let jsPlumb handle it
                } else if (e.target.closest('.world-node')) {
                    const parent = e.target.closest('.world-node');
                    if (parent.classList.contains('selected')) {
                        addNodeButton(parent, e.clientX - parent.getBoundingClientRect().left, e.clientY - parent.getBoundingClientRect().top);
                    }
                } else {
                    document.querySelectorAll('.world-node').forEach(n => n.classList.remove('selected'));
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

                if (element.classList.contains('world-node')) {
                    id = element.id;
                    type = element.dataset.type;
                    name = element.querySelector('strong').innerText;

                    content = `
                        <div><strong>ID:</strong> ${id}</div>
                        <div><strong>Type:</strong> ${type}</div>
                        <div><label><strong>Name:</strong> <input type="text" id="prop-name" value="${name}"></label></div>
                    `;

                    if (type === 'floor') {
                        const biome = element.dataset.biome || 'Cozy Forest';
                        const generationType = element.dataset.generationType || 'contrived';
                        content += `
                            <div><label><strong>Biome:</strong> 
                                <select id="prop-biome">
                                    <option value="Cozy Forest" ${biome === 'Cozy Forest' ? 'selected' : ''}>Cozy Forest</option>
                                    <option value="Grey Cave" ${biome === 'Grey Cave' ? 'selected' : ''}>Grey Cave</option>
                                    <option value="Shopping Mall" ${biome === 'Shopping Mall' ? 'selected' : ''}>Shopping Mall</option>
                                    <option value="Commercial Office" ${biome === 'Commercial Office' ? 'selected' : ''}>Commercial Office</option>
                                    <option value="Industrial Complex" ${biome === 'Industrial Complex' ? 'selected' : ''}>Industrial Complex</option>
                                    <option value="Aerospace Museum" ${biome === 'Aerospace Museum' ? 'selected' : ''}>Aerospace Museum</option>
                                </select>
                            </label></div>
                            <div><label><strong>Generation:</strong> 
                                <select id="prop-generation">
                                    <option value="contrived" ${generationType === 'contrived' ? 'selected' : ''}>Contrived</option>
                                    <option value="procedural" ${generationType === 'procedural' ? 'selected' : ''}>Procedural</option>
                                </select>
                            </label></div>
                        `;
                    }
                } else if (element.classList.contains('node-button')) {
                    id = element.parentElement.id + '-' + Array.from(element.parentElement.querySelectorAll('.node-button')).indexOf(element);
                    type = 'Node Button';

                    content = `
                        <div><strong>ID:</strong> ${id}</div>
                        <div><strong>Type:</strong> ${type}</div>
                    `;
                }

                inspectorContent.innerHTML = content;
                document.getElementById('delete-btn').style.display = 'block';

                if (element.classList.contains('world-node')) {
                    document.getElementById('prop-name').addEventListener('input', (e) => {
                        element.querySelector('strong').innerText = e.target.value;
                    });

                    if (element.dataset.type === 'floor') {
                        document.getElementById('prop-biome').addEventListener('change', (e) => {
                            element.dataset.biome = e.target.value;
                        });

                        document.getElementById('prop-generation').addEventListener('change', (e) => {
                            element.dataset.generationType = e.target.value;
                        });
                    }
                }
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
                inspectorContent.innerHTML = '<div class="inspector-empty"><p>Select an element to view properties</p></div>';
                document.getElementById('delete-btn').style.display = 'none';
                document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            }

            // Zoom
            document.getElementById('zoom-in-btn').addEventListener('click', () => {
                GridManager.setZoom(GridManager.zoomLevel + 0.1);
            });
            document.getElementById('zoom-out-btn').addEventListener('click', () => {
                GridManager.setZoom(GridManager.zoomLevel - 0.1);
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
