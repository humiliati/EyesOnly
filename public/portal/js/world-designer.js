(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        const worldCanvas = document.getElementById('world-canvas');
        const inspectorContent = document.getElementById('inspector-content');

        jsPlumb.ready(function() {
            const instance = jsPlumb.getInstance({
                Container: worldCanvas,
                DragOptions: { cursor: 'pointer', zIndex: 2000 },
                ConnectionOverlays: [
                    [ 'Arrow', { location: 1, width: 10, length: 10, id: 'arrow' } ]
                ]
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

            // Function to add a new node
            function addNode(type, name, top, left) {
                const id = `node-${nodeCounter++}`;
                const node = document.createElement('div');
                node.className = 'world-node';
                node.id = id;
                node.style.top = `${top}px`;
                node.style.left = `${left}px`;
                node.innerHTML = `<strong>${name}</strong><br>(${type})`;
                node.dataset.type = type;
                node.dataset.biome = 'Cozy Forest';
                node.dataset.generationType = 'contrived';
                worldCanvas.appendChild(node);

                instance.addEndpoint(id, { anchor: 'Top' });
                instance.addEndpoint(id, { anchor: 'Bottom' });
                instance.addEndpoint(id, { anchor: 'Left' });
                instance.addEndpoint(id, { anchor: 'Right' });

                instance.draggable(id);

                node.addEventListener('click', function() {
                    showInspector(id, type, name);
                });

                return node;
            }

            // Function to show the property inspector
            function showInspector(id, type, name) {
                const node = document.getElementById(id);
                const biome = node.dataset.biome;
                const generationType = node.dataset.generationType;

                inspectorContent.innerHTML = `
                    <div><strong>ID:</strong> ${id}</div>
                    <div><strong>Type:</strong> ${type}</div>
                    <div><label><strong>Name:</strong> <input type="text" id="prop-name" value="${name}"></label></div>
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
                    <button id="edit-layout-btn" class="btn btn-primary" ${generationType === 'procedural' ? 'disabled' : ''}>Edit Layout</button>
                `;

                document.getElementById('edit-layout-btn').addEventListener('click', function() {
                    const floorData = {
                        name: document.getElementById('prop-name').value,
                        biome: document.getElementById('prop-biome').value,
                        generationType: document.getElementById('prop-generation').value
                    };
                    localStorage.setItem(id, JSON.stringify(floorData));
                    window.open(`map-designer.html?floorId=${id}`, '_blank');
                });

                document.getElementById('prop-name').addEventListener('input', (e) => {
                    node.querySelector('strong').innerText = e.target.value;
                });

                document.getElementById('prop-biome').addEventListener('change', (e) => {
                    node.dataset.biome = e.target.value;
                });

                document.getElementById('prop-generation').addEventListener('change', (e) => {
                    node.dataset.generationType = e.target.value;
                    document.getElementById('edit-layout-btn').disabled = e.target.value === 'procedural';
                });
            }

            // Add tool event listeners
            document.querySelector('[data-tool="add-floor"]').addEventListener('click', function() {
                addNode('Floor', 'New Floor', 100, 100);
            });

            document.querySelector('[data-tool="add-building"]').addEventListener('click', function() {
                addNode('Building', 'New Building', 200, 200);
            });

            document.getElementById('export-world-btn').addEventListener('click', exportWorld);

            const importBtn = document.getElementById('import-world-btn');
            const importFileInput = document.getElementById('import-file');
            importBtn.addEventListener('click', () => importFileInput.click());
            importFileInput.addEventListener('change', importWorld);
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
