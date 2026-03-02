// SFC Evaluation Engine

var SFCEngine = (function() {
  'use strict';

  function evaluate(worldData, playerState, currentNodeId) {
    const currentNode = worldData.nodes.find(node => node.id === currentNodeId);
    if (!currentNode) return null;

    // Find all outgoing connections from the current node
    const outgoingConnections = worldData.connections.filter(conn => conn.from === currentNodeId);

    for (const connection of outgoingConnections) {
        const transitionNode = worldData.nodes.find(node => node.id === connection.to);

        // For now, assume all transitions are valid
        // In the future, we'll evaluate the transition condition here
        if (transitionNode && transitionNode.type === 'Transition') {
            const nextNodeConnection = worldData.connections.find(conn => conn.from === transitionNode.id);
            if (nextNodeConnection) {
                return nextNodeConnection.to; // Return the ID of the next step node
            }
        }
    }

    return null; // No valid path found
  }

  return {
    evaluate: evaluate
  };
})();
