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

            let nodeCounter = 0;
            let zoomLevel = 1;
            let selectedNodes = [];

            // Function to add a new node
            function addNode(type, name, top, left) {
                const id = `node-${nodeCounter++}`;

                if (top === undefined || left === undefined) {
                    const existingNodes = worldCanvas.querySelectorAll('.world-node').length;
                    top = GRID_SIZE * 3 + (existingNodes % 10) * (GRID_SIZE * 3);
                    left = GRID_SIZE * 3 + Math.floor(existingNodes / 10) * (GRID_SIZE * 10);
                }
                const node = document.createElement('div');
                node.className = 'world-node';
                node.id = id;
                node.style.top = `${top}px`;
                node.style.left = `${left}px`;
                node.innerHTML = `<strong>${name}</strong><br>(${type})`;
                node.dataset.type = type;

                switch (type) {
                    case 'Step':
                        node.style.backgroundColor = '#aaffaa'; // Green
                        break;
                    case 'Transition':
                        node.style.backgroundColor = '#ffffaa'; // Yellow
                        node.className += ' diamond';
                        break;
                    case 'Parallel':
                        node.style.backgroundColor = '#aaaaff'; // Blue
                        break;
                    case 'Convergence':
                        node.style.backgroundColor = '#ffaaaa'; // Red
                        break;
                }

                worldCanvas.appendChild(node);

                instance.addEndpoint(id, { anchor: 'Top' });
                instance.addEndpoint(id, { anchor: 'Bottom' });
                instance.addEndpoint(id, { anchor: 'Left' });
                instance.addEndpoint(id, { anchor: 'Right' });

                instance.draggable(id);

                node.addEventListener('click', function(e) {
                    if (e.ctrlKey || e.metaKey) {
                        if (selectedNodes.includes(id)) {
                            selectedNodes = selectedNodes.filter(nodeId => nodeId !== id);
                            node.classList.remove('selected');
                        } else {
                            selectedNodes.push(id);
                            node.classList.add('selected');
                        }
                    } else {
                        selectedNodes.forEach(nodeId => {
                            const el = document.getElementById(nodeId);
                            if (el) el.classList.remove('selected');
                        });
                        selectedNodes = [id];
                        node.classList.add('selected');
                    }
                    showInspector(selectedNodes);
                });

                return node;
            }

            // Function to show the property inspector
            function showInspector(selectedIds) {
                const deleteBtn = document.getElementById('delete-btn');
                if (selectedIds.length === 0) {
                    clearInspector();
                    return;
                }

                if (selectedIds.length === 1) {
                    const id = selectedIds[0];
                    const node = document.getElementById(id);
                    const type = node.dataset.type;
                    const name = node.querySelector('strong').innerText;

                    let content = `
                        <div><strong>ID:</strong> ${id}</div>
                        <div><strong>Type:</strong> ${type}</div>
                        <div><label><strong>Name:</strong> <input type="text" id="prop-name" value="${name}"></label></div>
                    `;

                    if (type === 'Step') {
                        const biome = node.dataset.biome || 'Cozy Forest';
                        const generationType = node.dataset.generationType || 'contrived';
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
                            <div><label><strong>Map:</strong>
                                <select id="prop-map"></select>
                            </label></div>
                            <button id="edit-layout-btn" class="btn btn-primary" ${generationType === 'procedural' ? 'disabled' : ''}>Edit Layout</button>
                        `;
                    } else if (type === 'Transition') {
                        const condition = node.dataset.condition || '';
                        content += `
                            <div><label><strong>Condition:</strong> <input type="text" id="prop-condition" value="${condition}"></label></div>
                        `;
                    }

                    inspectorContent.innerHTML = content;
                    document.getElementById('node-notes').value = node.dataset.notes || '';

                    document.getElementById('prop-name').addEventListener('input', (e) => {
                        node.querySelector('strong').innerText = e.target.value;
                    });

                    if (type === 'Step') {
                        document.getElementById('edit-layout-btn').addEventListener('click', function() {
                            const floorData = {
                                name: document.getElementById('prop-name').value,
                                biome: document.getElementById('prop-biome').value,
                                generationType: document.getElementById('prop-generation').value
                            };
                            localStorage.setItem(id, JSON.stringify(floorData));
                            window.open(`map-designer.html?floorId=${id}`, '_blank');
                        });

                        document.getElementById('prop-biome').addEventListener('change', (e) => {
                            node.dataset.biome = e.target.value;
                        });

                        document.getElementById('prop-generation').addEventListener('change', (e) => {
                            node.dataset.generationType = e.target.value;
                            document.getElementById('edit-layout-btn').disabled = e.target.value === 'procedural';
                        });

                        const mapSelect = document.getElementById('prop-map');
                        const floors = UnifiedDataManager.getAllFloors();
                        for (const floorName in floors) {
                            const option = document.createElement('option');
                            option.value = floorName;
                            option.textContent = floorName;
                            if (node.dataset.map === floorName) {
                                option.selected = true;
                            }
                            mapSelect.appendChild(option);
                        }

                        mapSelect.addEventListener('change', (e) => {
                            node.dataset.map = e.target.value;
                        });
                    } else if (type === 'Transition') {
                        document.getElementById('prop-condition').addEventListener('input', (e) => {
                            node.dataset.condition = e.target.value;
                        });
                    }

                } else {
                    inspectorContent.innerHTML = `<div>${selectedIds.length} nodes selected</div>`;
                    document.getElementById('node-notes').value = '';
                }

                deleteBtn.style.display = 'block';
            }

            function clearInspector() {
                inspectorContent.innerHTML = '<div class="inspector-empty"><p>Select a node to view properties</p></div>';
                document.getElementById('delete-btn').style.display = 'none';
                document.getElementById('node-notes').value = '';
            }

            document.getElementById('node-notes').addEventListener('input', (e) => {
                if (selectedNodes.length === 1) {
                    const node = document.getElementById(selectedNodes[0]);
                    if (node) {
                        node.dataset.notes = e.target.value;
                    }
                }
            });

            // Add tool event listeners
            document.querySelector('[data-tool="add-floor"]').addEventListener('click', function() {
                addNode('Floor', 'New Floor');
            });

            document.querySelector('[data-tool="add-building"]').addEventListener('click', function() {
                addNode('Building', 'New Building', undefined, undefined);
            });

            document.querySelector('[data-tool="add-step"]').addEventListener('click', function() {
                addNode('Step', 'New Step');
            });

            document.querySelector('[data-tool="add-transition"]').addEventListener('click', function() {
                addNode('Transition', 'New Transition');
            });

            document.querySelector('[data-tool="add-parallel"]').addEventListener('click', function() {
                addNode('Parallel', 'New Parallel Branch');
            });

            document.querySelector('[data-tool="add-convergence"]').addEventListener('click', function() {
                addNode('Convergence', 'New Convergence');
            });

            document.getElementById('export-world-btn').addEventListener('click', exportWorld);

            const importBtn = document.getElementById('import-world-btn');
            const importFileInput = document.getElementById('import-file');
            importBtn.addEventListener('click', () => importFileInput.click());
            importFileInput.addEventListener('change', importWorld);

            // Tabs
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.tab;
                    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                    btn.classList.add('active');
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    document.getElementById(`${tab}-tab`).classList.add('active');
                });
            });

            // Zoom
            document.getElementById('zoom-in-btn').addEventListener('click', () => {
                zoomLevel = Math.min(zoomLevel + 0.1, 2);
                instance.setZoom(zoomLevel);
            });
            document.getElementById('zoom-out-btn').addEventListener('click', () => {
                zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
                instance.setZoom(zoomLevel);
            });

            // Selection
            document.getElementById('select-all-btn').addEventListener('click', () => {
                selectedNodes = Object.keys(instance.getManagedElements());
                document.querySelectorAll('.world-node').forEach(node => node.classList.add('selected'));
            });
            document.getElementById('clear-selection-btn').addEventListener('click', () => {
                selectedNodes = [];
                document.querySelectorAll('.world-node.selected').forEach(node => node.classList.remove('selected'));
            });

            // Delete
            document.getElementById('delete-btn').addEventListener('click', () => {
                if (selectedNodes.length > 0) {
                    if (confirm(`Delete ${selectedNodes.length} node(s)?`)) {
                        selectedNodes.forEach(nodeId => instance.remove(nodeId));
                        selectedNodes = [];
                        clearInspector();
                    }
                }
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
