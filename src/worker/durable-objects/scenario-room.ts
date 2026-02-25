/* ============================================================
   EYES ONLY — ScenarioRoom Durable Object
   Real-time WebSocket hub for a single scenario.
   All ops and M Mode clients connect here for live state.
   ============================================================ */

import type { Env, WSMessage } from '../../shared/types';

interface ConnectedClient {
  ws: WebSocket;
  actorId: number;
  callsign: string;
  role: 'red' | 'blue' | 'director';
  connectedAt: number;
}

export class ScenarioRoom implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private clients: Map<WebSocket, ConnectedClient> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Restore WebSocket connections after hibernation
    this.state.getWebSockets().forEach((ws) => {
      const meta = ws.deserializeAttachment() as ConnectedClient | null;
      if (meta) {
        this.clients.set(ws, meta);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal broadcast endpoint (called by Worker routes)
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const message = await request.json<WSMessage>();
      this.broadcast(message);
      return new Response('OK');
    }

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      return this.handleWebSocketUpgrade(request, url);
    }

    // Client count (diagnostics)
    if (url.pathname === '/status') {
      return new Response(
        JSON.stringify({
          connections: this.clients.size,
          clients: Array.from(this.clients.values()).map((c) => ({
            callsign: c.callsign,
            role: c.role,
            connectedAt: c.connectedAt,
          })),
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  private handleWebSocketUpgrade(request: Request, url: URL): Response {
    const actorId = parseInt(url.searchParams.get('actor_id') || '0', 10);
    const callsign = url.searchParams.get('callsign') || 'unknown';
    const role = (url.searchParams.get('role') || 'red') as ConnectedClient['role'];

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    const clientMeta: ConnectedClient = {
      ws: server,
      actorId,
      callsign,
      role,
      connectedAt: Date.now(),
    };

    // Accept with hibernation API
    this.state.acceptWebSocket(server);
    server.serializeAttachment(clientMeta);
    this.clients.set(server, clientMeta);

    // Send initial welcome message
    server.send(
      JSON.stringify({
        type: 'state',
        data: {
          message: 'Connected to ScenarioRoom',
          callsign,
          role,
          connections: this.clients.size,
        },
        timestamp: Date.now(),
      } satisfies WSMessage),
    );

    // Notify other clients
    this.broadcast(
      {
        type: 'actor_update',
        data: {
          action: 'connected',
          callsign,
          role,
          actor_id: actorId,
        },
        timestamp: Date.now(),
      },
      server, // exclude the connecting client
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Broadcast a message to all connected WebSockets.
   * Optionally exclude one (e.g., the sender).
   * Respects `message.audience` for targeted routing:
   *  - 'actors'    → only red/blue team connections
   *  - 'directors' → only director connections
   *  - 'target'    → only the target_actor_id + all directors
   *  - 'all' / undefined → everyone (default)
   */
  private broadcast(message: WSMessage, exclude?: WebSocket): void {
    const payload = JSON.stringify(message);
    const audience = message.audience ?? 'all';
    const targetActorId = (message as any).target_actor_id as number | undefined;

    for (const [ws, client] of this.clients) {
      if (ws === exclude) continue;

      // Audience-based routing
      if (audience === 'actors' && client.role === 'director') continue;
      if (audience === 'directors' && client.role !== 'director') continue;
      if (audience === 'target') {
        // Send to the specific target actor AND all directors
        if (client.role !== 'director' && client.actorId !== targetActorId) continue;
      }

      try {
        ws.send(payload);
      } catch {
        // Connection dead, clean up
        this.clients.delete(ws);
        try {
          ws.close(1011, 'Send failed');
        } catch {
          // Already closed
        }
      }
    }
  }

  /**
   * Handle incoming WebSocket messages.
   * Called by the Hibernation API.
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));

      // Handle ping/pong
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', data: {}, timestamp: Date.now() }));
        return;
      }

      // Relay events from clients to all other clients
      if (data.type === 'event') {
        this.broadcast(
          {
            type: 'event',
            data: {
              ...data.data,
              from_callsign: client.callsign,
              from_role: client.role,
            },
            timestamp: Date.now(),
          },
          ws, // don't echo back to sender
        );
      }
    } catch {
      // Invalid message, ignore
    }
  }

  /**
   * Handle WebSocket close.
   * Called by the Hibernation API.
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const client = this.clients.get(ws);
    this.clients.delete(ws);

    if (client) {
      this.broadcast({
        type: 'actor_update',
        data: {
          action: 'disconnected',
          callsign: client.callsign,
          role: client.role,
          actor_id: client.actorId,
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle WebSocket error.
   * Called by the Hibernation API.
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    this.clients.delete(ws);
    try {
      ws.close(1011, 'WebSocket error');
    } catch {
      // Already closed
    }
  }

  /**
   * Periodic alarm for escalation timers and state checks.
   */
  async alarm(): Promise<void> {
    // Ping all clients to detect dead connections
    const deadClients: WebSocket[] = [];

    for (const [ws, client] of this.clients) {
      try {
        ws.send(
          JSON.stringify({ type: 'ping', data: {}, timestamp: Date.now() }),
        );
      } catch {
        deadClients.push(ws);
      }
    }

    // Clean up dead connections
    for (const ws of deadClients) {
      this.clients.delete(ws);
      try {
        ws.close(1011, 'Ping failed');
      } catch {
        // Already closed
      }
    }

    // Re-schedule alarm if there are active connections
    if (this.clients.size > 0) {
      this.state.storage.setAlarm(Date.now() + 30000); // 30s
    }
  }
}
