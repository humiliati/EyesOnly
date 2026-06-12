"""One-off: instrument the Python floor-0 walk to find where it diverges."""
import sys, time
sys.path.insert(0, "vendor")

from sundog.runners.adapters.gone_rogue import GoneRogueAdapter
from sundog.runners.scenarios.base import bfs_path, collect_cards

with GoneRogueAdapter(base_url="http://localhost:8787", headless=True) as a:
    a.reset(seed=99)
    s = a.get_state()
    print("start:", s["floor"], (s["player"]["x"], s["player"]["y"]), "items:", len(s["items"]))

    got = collect_cards(a, 3)
    s = a.get_state()
    print("cards collected:", got, "player:", (s["player"]["x"], s["player"]["y"]))

    p = bfs_path(a, 20, 17)
    print("bfs to (20,17):", None if p is None else f"{len(p)} steps: {p[:6]}...")

    if p:
        for i, (tx, ty) in enumerate(p):
            s = a.get_state()
            px, py = s["player"]["x"], s["player"]["y"]
            dx, dy = tx - px, ty - py
            acts = a.get_legal_actions() or []
            mv = next((x for x in acts if x.get("type") == "move" and x.get("dx") == dx and x.get("dy") == dy), None)
            if not mv:
                print(f"step {i}: NO MOVE from ({px},{py}) to ({tx},{ty}); dirs offered:",
                      [(x.get('dx'), x.get('dy')) for x in acts if x.get('type') == 'move'])
                break
            r = a.apply_action(mv)
            s2 = (r or {}).get("state") or a.get_state()
            nx, ny = s2["player"]["x"], s2["player"]["y"]
            if (nx, ny) != (tx, ty):
                print(f"step {i}: BLOCKED at ({tx},{ty}); player ({nx},{ny}); msgs:", (r or {}).get("messages", [])[:2])
                break
        else:
            print("walk complete; player:", (a.get_state()["player"]["x"], a.get_state()["player"]["y"]))
            # wait for advance
            t0 = time.time()
            while time.time() - t0 < 4:
                s = a.get_state()
                if s["floor"] != 0 and not s.get("transitioning"):
                    print("ADVANCED to floor", s["floor"])
                    break
                time.sleep(0.1)
            else:
                print("NO ADVANCE; floor still", a.get_state()["floor"])
