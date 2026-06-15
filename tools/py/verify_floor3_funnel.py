"""
Verify the floor-3 funnel seal + locked-gate unlock persistence.

Checks:
  1. FUNNEL: on floor 3, BEFORE unlocking, a pure-grid BFS (walls only)
     from spawn (20,2) to exit (20,16) finds NO path — the locked gate
     (stamped as WALL) plus the new row-9 flank walls seal the south.
  2. UNLOCK: after crate → key → INTERACT, the same BFS finds a path.
  3. PERSISTENCE: advance to floor 4, retreat back to floor 3 — the gate
     tiles must be EMPTY (FloorStateTracker) and the path must still exist,
     so a backtracking player isn't trapped south of a re-locked gate.

Usage:
    .venv_runner_test/Scripts/python.exe tools/py/verify_floor3_funnel.py
"""
import sys
import time
from collections import deque

sys.path.insert(0, "vendor")

from sundog.runners.adapters.gone_rogue import GoneRogueAdapter
from sundog.runners.scenarios.base import (
    bfs_path,
    follow_path,
    advance_floor,
    collect_cards,
    kick_until_clear,
    fight_combat,
    find_doors,
)

GATE_TILES = [(18, 9), (19, 9), (20, 9), (21, 9)]


def pure_grid_bfs(adapter, sx, sy, tx, ty):
    """BFS over the raw grid treating ONLY walls as blocked (no enemies/breakables)."""
    g = adapter.get_grid() or {}
    grid = g.get("grid") or []
    wall = (g.get("tiles") or {}).get("WALL")
    h = len(grid)
    w = len(grid[0]) if h else 0
    seen = {(sx, sy)}
    q = deque([(sx, sy)])
    while q:
        x, y = q.popleft()
        if (x, y) == (tx, ty):
            return True
        for dx, dy in ((0, -1), (0, 1), (1, 0), (-1, 0)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in seen or not (0 <= nx < w and 0 <= ny < h):
                continue
            if grid[ny][nx] == wall:
                continue
            seen.add((nx, ny))
            q.append((nx, ny))
    return False


def walk_to(adapter, x, y):
    # Door tiles avoided as transit (target exempt inside bfs_path).
    p = bfs_path(adapter, x, y, avoid=set(find_doors(adapter)))
    if p is None:
        return "no-path"
    _, post = follow_path(adapter, p)
    pl = post.get("player") or {}
    if post.get("strCombatActive"):
        return "combat"
    return "ok" if (pl.get("x"), pl.get("y")) == (x, y) else "blocked"


def gate_tiles_state(adapter):
    g = adapter.get_grid() or {}
    grid = g.get("grid") or []
    wall = (g.get("tiles") or {}).get("WALL")
    return {(x, y): ("WALL" if grid[y][x] == wall else "open") for (x, y) in GATE_TILES}


def main():
    failures = []

    def check(label, ok, detail=""):
        print(("[PASS] " if ok else "[FAIL] ") + label + (f" — {detail}" if detail else ""), flush=True)
        if not ok:
            failures.append(label)

    with GoneRogueAdapter(base_url="http://localhost:8787", headless=True) as a:
        a.reset(seed=42)

        # ── floors 0-2 (collect cards for the Trainer fight) ──
        collect_cards(a, 3)
        advance_floor(a, 20, 17)
        collect_cards(a, 3)
        advance_floor(a, 20, 17)
        walk_to(a, 20, 7)
        kick_until_clear(a, "south", 30)
        time.sleep(0.7)
        collect_cards(a, 3)
        adv = advance_floor(a, 20, 18)
        check("setup: reached floor 3", adv["to_floor"] == 3, f"floor={adv['to_floor']}")
        if adv["to_floor"] != 3:
            return 1

        # ── 1. FUNNEL: sealed before unlock ──
        print("gate tiles (locked):", gate_tiles_state(a), flush=True)
        sealed = not pure_grid_bfs(a, 20, 2, 20, 16)
        check("funnel: NO pure-grid path spawn→exit while gate locked", sealed)

        # ── 2. UNLOCK: crate → key → interact ──
        collect_cards(a, 3)
        walk_to(a, 20, 3)
        kick_until_clear(a, "south", 10)   # bush (20,4)
        time.sleep(0.7)
        walk_to(a, 20, 4)
        kick_until_clear(a, "south", 15)   # Marked Crate (20,5)
        time.sleep(1.0)
        key = next((i for i in (a.get_state() or {}).get("items", []) if i.get("type") == "key"), None)
        check("key dropped", key is not None)
        if key:
            walk_to(a, key["x"], key["y"])
            time.sleep(0.4)
        walk_to(a, 20, 8)
        ia = next((x for x in (a.get_legal_actions() or []) if x.get("type") == "interact"), None)
        check("interact offered at gate", ia is not None)
        if ia:
            a.apply_action(ia)
            time.sleep(0.4)
        print("gate tiles (after interact):", gate_tiles_state(a), flush=True)
        opened = pure_grid_bfs(a, 20, 2, 20, 16)
        check("funnel: path exists after unlock", opened)
        if not opened:
            return 1

        # ── Trainer fight → floor 4 ──
        r = walk_to(a, 20, 16)
        if r == "combat":
            fr = fight_combat(a)
            check("Trainer fight victory", fr["outcome"] == "victory", f"{fr['outcome']} r{fr['rounds']} hp{fr['player_hp']}")
            if fr["outcome"] != "victory":
                return 1
            time.sleep(1.0)
        adv = advance_floor(a, 20, 16)
        check("advanced to floor 4", adv["to_floor"] == 4, f"floor={adv['to_floor']}")
        if adv["to_floor"] != 4:
            return 1

        # ── 3. PERSISTENCE: retreat to floor 3, gate must stay open ──
        backs = find_doors(a, "back")
        check("floor 4 has a retreat door", bool(backs), f"{backs!r}")
        if not backs:
            return 1
        bx, by = backs[0]
        all_doors = set(find_doors(a))  # avoid BOTH door kinds while wandering

        # Burn the 5-step door guardrail: wander away from the back door,
        # avoiding ALL doors (the first version of this loop walked onto the
        # forward door and accidentally advanced to floor 5).
        s = a.get_state() or {}
        p = s.get("player") or {}
        for _ in range(8):
            moves = [m for m in (a.get_legal_actions() or [])
                     if m.get("type") == "move" and (m["targetX"], m["targetY"]) not in all_doors]
            far = [m for m in moves if abs(m["targetX"] - bx) + abs(m["targetY"] - by) >
                   abs(p.get("x", 0) - bx) + abs(p.get("y", 0) - by)]
            pick = (far or moves)
            if not pick:
                break
            a.apply_action(pick[0])
            p = (a.get_state() or {}).get("player") or {}

        # Walk to the back door avoiding the forward door, then wait for the retreat.
        fwd_doors = set(find_doors(a, "forward"))
        rp = bfs_path(a, bx, by, avoid=fwd_doors)
        check("path to retreat door (avoiding forward door)", rp is not None)
        if rp is None:
            return 1
        follow_path(a, rp)
        deadline = time.time() + 5
        while time.time() < deadline:
            st = a.get_state() or {}
            if st.get("floor") == 3 and not st.get("transitioning"):
                break
            time.sleep(0.15)
        final_floor = (a.get_state() or {}).get("floor")
        check("retreated to floor 3", final_floor == 3, f"floor={final_floor}")
        if final_floor != 3:
            return 1
        print("gate tiles (revisit):", gate_tiles_state(a), flush=True)
        all_open = all(v == "open" for v in gate_tiles_state(a).values())
        check("persistence: gate tiles open on revisit", all_open)
        path_back = pure_grid_bfs(a, 20, 16, 20, 2)
        check("persistence: pure-grid path exit→spawn exists on revisit", path_back)

    print(("\nALL CHECKS PASSED" if not failures else f"\nFAILURES: {failures}"), flush=True)
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
