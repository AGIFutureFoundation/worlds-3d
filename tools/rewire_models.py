#!/usr/bin/env python3
"""Rewire worlds-3d missing_models / district model refs to hosted GLBs.

One-time migration (2026-11-06): the 150 staged GLBs + Container.glb are now
live in the worlds-3d repo at assets/glb/. This script updates the canonical
world definitions in worlds/*.json so the engine points at the hosted files
instead of the unhosted fabric-relative paths:

  - missing_models entries whose fabric ref is FOUND in the Phase 2 hosting
    manifest (WORLDS-3D-PHASE2-REPORT.md §2.3):
        ref    -> assets/glb/<basename>.glb   (the manifest's Target column)
        status -> "hosted"
  - district model_ref / model_status for the same FOUND refs:
        model_ref    -> assets/glb/<basename>.glb
        model_status -> "hosted"
  - The 17 NOT FOUND refs are left byte-identical (fabric ref + the
    "not hosted — procedural placeholder shown" status). No substitutes.

Idempotent: already-rewired entries (ref already assets/glb/..., status
"hosted") are skipped. After running, regenerate data.js:
    python3 tools/gen_data_js.py

Do NOT run tools/build_worlds.py — its main() would wipe the Phase 2 fill.
"""
import json
import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPORT = ROOT / "WORLDS-3D-PHASE2-REPORT.md"
WORLDS_DIR = ROOT / "worlds"

HOSTED_STATUS = "hosted"
PLACEHOLDER_STATUS = "not hosted \u2014 procedural placeholder shown"


def parse_manifest():
    """Parse the §2.3 hosting-manifest table -> {fabric_ref: (found, size, target)}."""
    text = REPORT.read_text()
    start = text.index("### 2.3 Hosting manifest")
    section = text[start:]
    manifest = {}
    for line in section.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            if manifest:
                break  # table ended
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 8 or cells[0].strip("` ") in ("#", "---", "") or cells[1].startswith("---"):
            continue
        ref = cells[1].strip("`")
        status_cell = cells[2 + 1]  # Status column
        size_cell = cells[4]
        target_cell = cells[7].strip("`")
        if "NOT FOUND" in status_cell:
            found = False
        elif "FOUND" in status_cell:
            found = True
        else:
            continue  # header / separator row
        size = int(size_cell) if size_cell.isdigit() else None
        target = target_cell if found else None
        if found:
            # sanity: target must be the flat hosted path for the same basename
            assert target == "assets/glb/" + os.path.basename(ref), (
                f"manifest target mismatch for {ref}: {target}")
            assert size is not None and size > 0, f"manifest size missing for {ref}"
        manifest[ref] = (found, size, target)
    assert len(manifest) == 168, f"expected 168 manifest rows, got {len(manifest)}"
    assert sum(1 for f, _, _ in manifest.values() if f) == 151, "expected 151 FOUND"
    assert sum(1 for f, _, _ in manifest.values() if not f) == 17, "expected 17 NOT FOUND"
    return manifest


def main():
    manifest = parse_manifest()
    total_entries = total_rewired = total_left = 0
    total_districts = districts_rewired = districts_left = 0
    per_world = {}
    for path in sorted(WORLDS_DIR.glob("*.json")):
        world = json.loads(path.read_text())
        w_entries = w_rewired = w_left = 0
        d_rewired = d_left = 0
        for entry in world.get("missing_models", []):
            ref = entry["ref"]
            total_entries += 1
            w_entries += 1
            if ref.startswith("assets/glb/") and entry.get("status") == HOSTED_STATUS:
                w_left += 0  # already rewired; counts as rewired below
                w_rewired += 1
                total_rewired += 1
                continue
            if ref not in manifest:
                raise SystemExit(f"{world['id']}: missing_models ref not in §2.3 manifest: {ref}")
            found, _size, target = manifest[ref]
            if found:
                entry["ref"] = target
                entry["status"] = HOSTED_STATUS
                w_rewired += 1
                total_rewired += 1
            else:
                # NOT FOUND: leave byte-identical (fabric ref + placeholder status)
                assert entry["status"] == PLACEHOLDER_STATUS, (
                    f"{world['id']}: unexpected status for NOT FOUND {ref}: {entry['status']}")
                w_left += 1
                total_left += 1
        for d in world.get("districts", []):
            ref = d.get("model_ref")
            if ref is None:
                continue
            total_districts += 1
            if ref.startswith("assets/glb/") and d.get("model_status") == HOSTED_STATUS:
                d_rewired += 1
                districts_rewired += 1
                continue
            if ref not in manifest:
                raise SystemExit(f"{world['id']}: district model_ref not in §2.3 manifest: {ref}")
            found, _size, target = manifest[ref]
            if found:
                d["model_ref"] = target
                d["model_status"] = HOSTED_STATUS
                d_rewired += 1
                districts_rewired += 1
            else:
                assert d["model_status"] == PLACEHOLDER_STATUS, (
                    f"{world['id']}: unexpected district status for NOT FOUND {ref}")
                d_left += 1
                districts_left += 1
        # write back byte-identical formatting for untouched content:
        # indent=2, raw UTF-8 (ensure_ascii=False), trailing newline
        path.write_text(json.dumps(world, indent=2, ensure_ascii=False) + "\n")
        per_world[world["id"]] = (w_entries, w_rewired, w_left, d_rewired, d_left)

    print(f"missing_models entries: {total_entries} total, "
          f"{total_rewired} rewired to hosted, {total_left} left as placeholders")
    print(f"district model_refs: {total_districts} total, "
          f"{districts_rewired} rewired to hosted, {districts_left} left as placeholders")
    for wid, (e, r, l, dr, dl) in per_world.items():
        print(f"  {wid}: missing_models {e} ({r} hosted, {l} placeholder), "
              f"districts {dr} hosted, {dl} placeholder")


if __name__ == "__main__":
    main()
