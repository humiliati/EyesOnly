"""
Repro hunt for the floor 7→10 multi-advance.

Replays the soak path (seed CLI arg, default 11). After every
advance_floor call, reads the floor counter; on any jump >= 2 floors,
dumps window.__floorTransLog (the FloorTransitionSystem forensics ring
buffer: every advance/retreat attempt with caller stack + lock verdict)
and exits non-zero.

Usage:
    .venv_runner_test/Scripts/python.exe tools/py/debug_multi_advance.py [seed] [target_floor]
"""
import json
import sys
import time

sys.path.insert(0, "vendor")

from sundog.runners.adapters.gone_rogue import GoneRogueAdapter
from sundog.runners.scenarios.base import (
    traverse_tutorial,
    find_doors,
    advance_floor,
    fight_combat,
    collect_cards,
    bfs_path,
    clear_path_obstructions,
)

SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 11
TARGET = int(sys.argv[2]) if len(sys.argv) > 2 else 10


def dump_translog(adapter, label):
    log = adapter._page.evaluate("() => window.__floorTransLog || []")
    print(f"\n===== TRANSITION LOG ({label}) — {len(log)} entries =====")
    for e in log:
        ts = e.get("t")
        print(f"  t={ts} {e.get('fn')} accepted={e.get('accepted')} floor={e.get('floor')} "
              f"player={e.get('player')}")
        print(f"    stack: {e.get('stack')}")
    print("===== END TRANSITION LOG =====\n", flush=True)
    return log


def main():
    with GoneRogueAdapter(base_url="http://localhost:8787", headless=True) as a:
        a.reset(seed=SEED)
        print(f"[repro] seed={SEED} target={TARGET}", flush=True)

        r = traverse_tutorial(a)
        print(f"[repro] tutorial: {' | '.join(r['trace'])}", flush=True)
        if not r["ok"]:
            print("[repro] tutorial failed — aborting")
            return 2

        while True:
            state = a.get_state() or {}
            floor = state.get("floor")
            if floor is None or floor >= TARGET:
                break

            collect_cards(a, 2)
            exits = find_doors(a, "forward")
            if not exits:
                print(f"[repro] floor {floor}: no forward door"); return 2
            ex, ey = exits[0]

            p = bfs_path(a, ex, ey)
            if p is None:
                cr = clear_path_obstructions(a, ex, ey)
                print(f"[repro] floor {floor} unblock: {cr['cleared']} {cr['log']}", flush=True)

            advanced = False
            attempts = 0
            while not advanced and attempts < 4:
                attempts += 1
                pre = (a.get_state() or {}).get("floor")
                adv = advance_floor(a, ex, ey, enemy_buffer=1)
                post = (a.get_state() or {}).get("floor")
                print(f"[repro] floor {pre} attempt {attempts}: adv={adv['advanced']} "
                      f"to={adv['to_floor']} post-read={post}", flush=True)

                if post is not None and pre is not None and post - pre >= 2:
                    print(f"\n!!!!! MULTI-ADVANCE: {pre} -> {post} !!!!!", flush=True)
                    dump_translog(a, f"{pre}->{post}")
                    return 1

                if adv["advanced"]:
                    advanced = True
                    break
                mid = a.get_state() or {}
                if mid.get("strCombatActive"):
                    fr = fight_combat(a, max_rounds=15, allow_flee=True, flee_below_hp=6)
                    print(f"[repro] floor {pre} combat: {fr['outcome']} r{fr['rounds']} hp{fr['player_hp']}", flush=True)
                    # post-combat floor check — victory sequences have been
                    # implicated in position/state weirdness before
                    post_combat = (a.get_state() or {}).get("floor")
                    if post_combat is not None and pre is not None and post_combat - pre >= 2:
                        print(f"\n!!!!! MULTI-ADVANCE AFTER COMBAT: {pre} -> {post_combat} !!!!!", flush=True)
                        dump_translog(a, f"combat {pre}->{post_combat}")
                        return 1
                    if fr["outcome"] == "defeat":
                        print("[repro] died — rerun for another sample")
                        return 3
                    time.sleep(1.0)

        final = (a.get_state() or {}).get("floor")
        print(f"[repro] completed without multi-advance; final floor {final}")
        dump_translog(a, "clean-run tail")
        return 0


if __name__ == "__main__":
    sys.exit(main())
