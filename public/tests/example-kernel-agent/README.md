# Example Kernel Agent (Decision API)

This is a minimal external agent server that plugs into EyesOnly Gone Rogue via the **Kernel Decision API**.

## What it is
Implements the required endpoints:
- `GET /health`
- `POST /next_action`

Strategy is intentionally simple (exit > currency > north/east move > first action).

## Run it

From repo root:

```powershell
cd public\tests\example-kernel-agent
node server.js
```

(default port is 5005; override with `$env:PORT=5006`)

## Connect it in-game

1) Start EyesOnly locally (`wrangler dev --local`)
2) Login so Kernel button enables
3) In the terminal:

```text
KERNEL CONNECT http://127.0.0.1:5005
```

4) Enter Gone Rogue:

```text
rogue
```

5) Start external agent run:

```text
KERNEL RUN
```

## Troubleshooting
- If CONNECT fails, confirm `http://127.0.0.1:5005/health` returns JSON.
- If actions stall, ensure the agent returns an action present in `legal_actions`.
