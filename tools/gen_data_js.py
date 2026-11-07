#!/usr/bin/env python3
"""Generate worlds-3d/data.js from the canonical JSON sources.

Reads:
  - data/worlds.json        (the verbatim 544-world list + collections)
  - worlds/*.json           (the 7 flagship world definitions)
Writes:
  - data.js                 (window.WORLDS_DATA — no fetch needed at runtime,
                             so the lobby and player work from file:// as well
                             as from Pages; GLB props still need http(s) to load)

Deterministic output (sorted keys, fixed separators). Re-run after any
world JSON changes:  python3 tools/gen_data_js.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

def main():
    worlds = json.loads((ROOT / "data" / "worlds.json").read_text())
    flagships = {}
    for path in sorted((ROOT / "worlds").glob("*.json")):
        definition = json.loads(path.read_text())
        flagships[definition["id"]] = definition

    payload = {
        "generated_by": "tools/gen_data_js.py — generated from data/worlds.json + worlds/*.json",
        "world_count": len(worlds["worldforge_worlds"]),
        "collections": worlds.get("collections", []),
        "worlds": worlds["worldforge_worlds"],
        "flagships": flagships,
        "flagship_ids": sorted(flagships),
    }
    out = ROOT / "data.js"
    out.write_text(
        "/* Generated — do not edit by hand. Re-run: python3 tools/gen_data_js.py */\n"
        "window.WORLDS_DATA = "
        + json.dumps(payload, sort_keys=True, separators=(",", ":"))
        + ";\n"
    )
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    print(f"worlds: {payload['world_count']}, flagships: {payload['flagship_ids']}")
    for fid, definition in flagships.items():
        print(
            f"  {fid}: districts={len(definition.get('districts', []))} "
            f"buildings={len(definition.get('buildings', []))} "
            f"npcs={len(definition.get('npcs', []))} "
            f"quests={len(definition.get('quests', []))} "
            f"collectibles={len(definition.get('collectibles', []))} "
            f"missing_models={len(definition.get('missing_models', []))}"
        )

if __name__ == "__main__":
    main()
