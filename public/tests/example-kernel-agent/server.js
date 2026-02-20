/*
  Example Kernel Decision Agent (kernel-decision-v1)

  This is a minimal external agent server that can be connected via:

    KERNEL CONNECT http://127.0.0.1:5005

  It implements:
    GET  /health
    POST /next_action

  Strategy (intentionally simple):
    1) If exit available -> exit
    2) If pickupCurrency available -> pickupCurrency
    3) Else move north/east if possible
    4) Else first legal action

  Run:
    cd public/tests/example-kernel-agent
    npm install  (optional; no deps)
    npm run start
*/

import http from 'node:http';

const PORT = Number(process.env.PORT || 5005);

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1_000_000) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function chooseAction(legalActions) {
  if (!Array.isArray(legalActions) || legalActions.length === 0) return { type: 'wait' };

  // Prefer exit
  const exit = legalActions.find(a => a && a.type === 'exit');
  if (exit) return exit;

  // Prefer currency
  const cur = legalActions.find(a => a && a.type === 'pickupCurrency');
  if (cur) return cur;

  // Prefer north/east moves
  const moves = legalActions.filter(a => a && a.type === 'move');
  const north = moves.find(a => a.direction === 'north');
  if (north) return north;
  const east = moves.find(a => a.direction === 'east');
  if (east) return east;

  return legalActions[0];
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return res.end();
    }

    if (req.url === '/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        agent_name: 'ExampleKernelAgent',
        agent_version: '0.0.1',
        protocol: 'kernel-turn-envelope-v1'
      });
    }

    if (req.url === '/turn_envelope' && req.method === 'POST') {
      const raw = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(raw || '{}');
      } catch {
        return sendJson(res, 400, { error: 'bad_json' });
      }

      const envelope = payload && payload.envelope ? payload.envelope : {};
      const legal = (envelope.execution && envelope.execution.legalActions) || (envelope.perception && envelope.perception.legalActions) || [];
      const suggestedBatch = (envelope.execution && envelope.execution.suggestedBatchSize) || 3;

      const primary = chooseAction(legal);
      const batch = [];
      if (primary) batch.push(primary);

      // Simple batching: keep moving in same direction if possible
      if (primary && primary.type === 'move') {
        const followMoves = legal.filter((a) => a.type === 'move' && a.direction === primary.direction);
        for (let i = 0; i < followMoves.length && batch.length < suggestedBatch; i++) {
          batch.push(followMoves[i]);
        }
      }

      if (!batch.length && legal.length) {
        batch.push(legal[0]);
      }

      const threats = (envelope.perception && envelope.perception.threats && envelope.perception.threats.count) || 0;
      const axis = threats > 0 ? 'survival' : 'progression';

      return sendJson(res, 200, {
        utility: { axis, rationale: threats > 0 ? 'Visible threats' : 'Fast traversal' },
        commentary: batch.length > 1 ? 'Batching ' + batch.length + ' actions' : 'Single-step action',
        execution: {
          actions: batch,
          stop: { onEnemy: true, onDamage: true, maxActions: Math.max(1, batch.length) }
        }
      });
    }

    if (req.url === '/next_action' && req.method === 'POST') {
      const raw = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(raw || '{}');
      } catch {
        return sendJson(res, 400, { error: 'bad_json' });
      }

      const obs = payload && payload.observation ? payload.observation : {};
      const legal = obs.legal_actions || [];
      const action = chooseAction(legal);

      return sendJson(res, 200, {
        action,
        commentary: 'Picked ' + (action.type || 'wait')
      });
    }

    return sendJson(res, 404, { error: 'not_found' });

  } catch (e) {
    return sendJson(res, 500, { error: 'server_error', message: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, () => {
  // Avoid fancy unicode in Windows consoles
  console.log('ExampleKernelAgent listening on http://127.0.0.1:' + PORT);
  console.log('Health:  curl.exe http://127.0.0.1:' + PORT + '/health');
});
