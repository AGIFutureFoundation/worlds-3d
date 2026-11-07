# Worlds 3D — Phase 2 Report: Environments Complete, 100% Agentic, Tested

**Build folder:** `~/workspace/your_files/worlds-3d/`
**Date:** 2026-11-06 (evening PST)
**Status:** LOCAL BUILD ONLY. Nothing pushed, deployed, sent, or posted. The live site still serves Phase 1 (see §5.4). Deploy via the push manifest in §6.
**What Phase 2 did:** finished the environments (every district has buildings, every NPC has dialogue + a quest, every building has an interior), mapped every flagship to the real Virtuals agents with honest offline status, added real weather presets + companion greetings to the engine, linked the lobby and every world info panel to the live agent marketplace, and located 151 of the 168 fabric GLBs with a ready upload plan. No media generated (no images/videos). Visual template/branding unchanged (navy/gold/teal).

## 1. Environment completeness

### 1.1 Before / after counts

| World | Districts | Buildings | NPCs | Quests | Collectibles |
|---|---|---|---|---|---|
| SmartCiti.X Holodeck | 8 → 8 | 23 → **122** | 4 → 4 | 3 → 3 | 8 → 8 |
| Cognition.X Campus | 5 → 5 | 25 → 25 | 4 → 4 | 3 → 3 | 8 → 8 |
| Locator.X | 7 → 7 | 9 → 9 | 5 → **9** | 3 → **7** | 7 → **11** |
| Biota.blockchain | 6 → 6 | 8 → 8 | 5 → **9** | 3 → **7** | 8 → **12** |
| Empathic.X | 6 → 6 | 8 → 8 | 5 → **8** | 3 → **6** | 7 → **10** |
| Diagnostic.X | 5 → 5 | 7 → 7 | 5 → **7** | 3 → **6** | 7 → **10** |
| AGI Corp Hub | 1 → 1 | 7 → 7 | 3 → 3 | 2 → 2 | 6 → 6 |
| **Totals** | **38** | **87 → 186** | **31 → 44** | **20 → 34** | **51 → 65** |

### 1.2 Audit findings (pre-fill) and what was filled

- **One NPC had no quest link:** Diagnostic's Host Advisor had 2 dialogue lines but `quest: null` and no quest step referenced it. Fixed: given `quest: q-host-welcome` plus a new 3-step quest. All other 30 NPCs already passed.
- **Holodeck's 7 non-Structural districts had zero hall buildings.** Filled: all 99 hall nodes built as buildings — real fabric names + own fabric positions through `fabric_transform` (scale 0.15), size [14,8,14], district palette colour, exactly as Phase 1 did for the Structural halls. Envelope & Finish 21, Building Systems 18, Energy & Utilities 17, Earthworks & Plant 12, Heavy Industry 10, Transport & Mobility 10, Survey/Safety/Environment 11. Every new building got 2 interior rooms (Training Floor + Tool Crib, `props: []`).
- **Skipped Agent/Advisor NPCs (+13 NPCs, +14 quests, +14 collectibles):** Locator +4 (Developer Brief Desk, Host Advisor, Steward Liaison, Alignment Advisor), Biota +4 (Communication Agent + 3 advisors), Empathic +3 (3 advisors), Diagnostic +2 (Steward Liaison, Alignment Advisor) + the Host Advisor fix. Every new NPC has 2 lines of original game dialogue, a `quest` field, and a new 3-step quest (talk → collect new collectible → visit place), all targets resolving. Advisor dialogue states the steward seats are held by humans and advisors only carry messages / never decide. No NPC claims to be a real person. Steward seats 1–3 were **not** made into NPCs (human seats).
- **Buildings without rooms: none** — every building already had ≥1 room, pre- and post-fill.
- **Quest step targets: all resolved** pre- and post-fill (verified programmatically, §5).

### 1.3 Fabric nodes used vs left unused

| Fabric | Total nodes | Used after fill | Left unused (and why) |
|---|---|---|---|
| Holodeck | 131 | 130 (8 districts + 111 halls + 11 sims) | Scene root only (not a place) |
| Cognition | 26 | 25 packs as buildings (5 also districts) | Scene root only; no Agent/Advisor nodes exist, so no NPCs to add |
| Locator | 38 | 18 (7 zones + 6 agents + 3 advisors + gate + sign) | Root; Swarm coordinator + 6 Swarm children (swarm duplicates of agents, not separate characters); 7 Light nodes (lighting, not places); Sky; Terrain; 3 Steward seats (human — never NPCs) |
| Biota | 36 | 17 (6 zones + 6 agents + 3 advisors + gate + sign) | Root; Swarm coordinator + 6 Swarm; 6 Lights; Sky; Terrain; 3 Steward seats (human) |
| Empathic | 34 | 16 (6 zones + 5 agents + 3 advisors + gate + sign) | Root; Swarm coordinator + 5 Swarm; 6 Lights; Sky; Terrain; 3 Steward seats (human) |
| Diagnostic | 30 | 14 (5 zones + 4 agents + 3 advisors + gate + sign) | Root; Swarm coordinator + 4 Swarm; 5 Lights; Sky; Terrain; 3 Steward seats (human) |
| Hub | 9 | 7 buildings | Scene root; Fill Light + Rim Light (no model ref) |

### 1.4 Honest caveats (kept, not silently fixed)

- **Holodeck hall overlap:** hall positions are each fabric node's own position, so halls from different districts share the same central plan grid and overlap in-world — the fabric gives no per-district offset, and Phase 1's Structural halls already overlap the same way. Labelled in the world's `sources`. A district-offset layout would be a deliberate redesign, not a fill.
- **All 168 distinct fabric GLB refs remain `missing_models`** with "not hosted — procedural placeholder shown" until the upload in §2 lands. No prop paths were invented; all new room `props` arrays are empty.
- **Unchanged as instructed:** weather presets, coordinates, `fabric_url`, status, `rp1` (all null) — verified post-fill.

### 1.5 ⚠️ Generator out of sync — do not re-run `tools/build_worlds.py` as a script

`tools/build_worlds.py` `main()` regenerates all 7 world JSONs from Phase 1 code and **would wipe this entire Phase 2 fill**. Its `verify()` function is safe to run by import (it only reads), and it passes with 0 errors — but `main()` must not be run until the generator is updated to reproduce the Phase 2 content (Holodeck's 99 halls, the 13 new NPCs/quests, companion greetings). Until then, `worlds/*.json` is the canonical source; `tools/gen_data_js.py` (regenerate `data.js` only) remains safe and was used for this phase.

## 2. The 168 fabric GLBs — hosting plan

Full research file: `/tmp/w3phase2/glb-hunt.md` (311 lines; per-ref table, evidence files in `/tmp/w3phase2/`). Research only — nothing uploaded.

### 2.1 Result: 151 of 168 FOUND, 17 NOT FOUND anywhere reachable

- **FOUND: 151/168**, all in public repo **AGIFutureFoundation/WorldForge-Browser** (`main`). Every one verified live: raw.githubusercontent.com HEAD → **200, Content-Length exactly equal to git-tree size, 151/151** (independent re-check by the coordinator: all 151 entries in `/tmp/w3phase2/head-verified.json` are 200 with matching sizes; total **10,661,608 bytes = 10.17 MiB**). Largest single file: `coordinator.glb`, 2,180,424 bytes — every file is under GitHub's 25 MB web-upload limit.
- **NOT FOUND: 17/168** — no exact file and no basename match in WorldForge-Browser (948 GLBs, full recursive tree, `truncated: false`) or in 8 other plausible repos (`worldforge-site`, `Cognition.X`, `Locator.X`, `SmartCiti.X`, `trueforge`, `vr-safety-training`, `ConstructionVR`, `SmartCiti.X-VR-BAC-Yard` — all contain **zero** `.glb` files). `AGIFutureFoundation/agi-corp-worlds` returns **API 404** (nonexistent or private; no sign-in attempted). All 17 resolved URLs HEAD-checked → 404 on both raw and Pages (coordinator spot-checks: `agent.glb` 404, `env-sky.glb` 404).
- **Coverage is lopsided:** Holodeck 124/124, Cognition.X 26/26 — fully recoverable. Locator, Biota, Empathic, Diagnostic each **1/12** (only `coordinator.glb`); their 11 missing models each are the shared `../models/` set (advisors, agent, env-sky, env-terrain, gate, steward, zone-marker) plus their per-world `sign-*` / `world-*` models.
- **Zero exact resolved-path matches.** The fabrics' relative paths point at directories that do not exist in the repo (no `site/models/`, no `site/my-fabric/models/`). The 151 are basename matches at reorganised paths — the manifest below gives the canonical source per ref; **do not fetch via fabric-relative paths**. Canonical groups: cognition 26 → `worldforge/fabrics/assets/cognition-models/`; holodeck halls+deck 112 → `worldforge/fabrics/assets/holodeck-models/`; sims 11 + Container → `rp1/smartciti-holodeck/objects/`; coordinator → `site/worldforge/out/assets/avatars/` (the only one of the 151 also Pages-servable; the other 150 are raw-only since Pages serves just `site/`).
- **No basename collisions:** all 168 basenames are distinct, so flat `assets/glb/<basename>` targets work with zero renames. 124 of the 151 exist twice in the repo, but every duplicate pair is byte-identical (same blob SHA); the manifest picks one canonical copy each.
- **Container.glb — already on disk (hash-proven by the coordinator):** the repo copy `rp1/smartciti-holodeck/objects/Container.glb` downloads to sha256 `0ab03bb08024dcf7f09f9b1d61e9948cb10e1614fd8b62171b4515392efc60a4` — **identical** to local `assets/glb/Container.glb`. It needs NO upload. The upload step therefore fetches **150 new files, 10,007,608 bytes (9.54 MiB)**.
- **Near-misses are not substitutes:** per-world `env-sky-<world>.glb` variants exist but no plain `env-sky.glb`; `wing-gate.glb` / `wing-steward-seat.glb` are different models. Do not silently substitute.
- **Not verified:** file contents were never downloaded or opened (except the Container hash check above) — HEAD + tree size + blob SHA prove existence/size/duplicate-identity only, not that each GLB parses in Three.js. The upload step must load-test at least one file per group (a hall, a pack, a sim, coordinator) after upload.

### 2.2 Upload plan (for the separate upload step — NOT done here)

1. Fetch the **150 new files** from their canonical raw URLs in the manifest below (HEAD-verified 200; total 10,007,608 bytes / 9.54 MiB — Container.glb already on disk, skip it). Do not fetch via fabric-relative paths.
2. Place each at `assets/glb/<basename>` in the worlds-3d repo (flat layout, no renames). Largest file 2,180,424 bytes (`coordinator.glb`); every file under the 25 MB web-upload limit — use the existing pattern (browser web upload, sub-batches of ~5, one commit per batch; expect ~30 batches for 150 files, or larger batches if the uploader allows — the earlier 7-GLB upload used batches of 4+3).
3. After upload, verify each live file on Pages returns 200 with the matching byte size (same check as §2.1), then **rewire the worlds**: each world's `missing_models` entries for the 151 found refs change status to hosted with model path `assets/glb/<basename>` (or add an engine-side ref→basename map), district `model_status` updates from "not hosted" where its model now exists, and `data.js` is regenerated. The 17 NOT FOUND refs stay as labelled placeholders until a decision is made: (a) generate/procure new models for the 4 world fabrics' shared set, (b) reuse the per-world `env-sky-<world>.glb` variants already in `site/my-fabric/worlds/models/` as the sky only, or (c) leave those 4 worlds partially procedural.
4. Load-test one file per group in a real browser (a hall, a pack, a sim, coordinator) before calling the models live.

### 2.3 Hosting manifest — all 168 refs

Status: **FOUND** = basename exists in WorldForge-Browser at the canonical repo path shown, raw HEAD 200 + Content-Length == tree size. **NOT FOUND** = no basename anywhere in the repos checked. Target = proposed path in the worlds-3d repo for the upload step (`assets/glb/<basename>`). Raw URL base: `https://raw.githubusercontent.com/AGIFutureFoundation/WorldForge-Browser/main/`.

| # | Fabric ref (`sReference`) | Fabrics | Status | Size (bytes) | Canonical source (repo path) | Alternate identical copy in repo | Target in worlds-3d |
|---|---|---|---|---|---|---|---|
| 1 | `../models/advisor-alignment.glb` | biota.json,diagnostic.json,empathic.json,locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 2 | `../models/advisor-host.glb` | biota.json,diagnostic.json,empathic.json,locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 3 | `../models/advisor-steward.glb` | biota.json,diagnostic.json,empathic.json,locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 4 | `../models/agent.glb` | biota.json,diagnostic.json,empathic.json,locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 5 | `../models/coordinator.glb` | biota.json,diagnostic.json,empathic.json,locator.json | FOUND (raw 200) | 2180424 | `site/worldforge/out/assets/avatars/coordinator.glb` | `worldforge/out/assets/avatars/coordinator.glb` | `assets/glb/coordinator.glb` |
| 6 | `../models/env-sky.glb` | biota.json,diagnostic.json,empathic.json,locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 7 | `../models/env-terrain.glb` | biota.json,diagnostic.json,empathic.json,locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 8 | `../models/gate.glb` | biota.json,diagnostic.json,empathic.json,locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 9 | `../models/sign-biota-blockchain.glb` | biota.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 10 | `../models/sign-diagnostic-x.glb` | diagnostic.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 11 | `../models/sign-empathic-x.glb` | empathic.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 12 | `../models/sign-locator-x.glb` | locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 13 | `../models/steward.glb` | biota.json,diagnostic.json,empathic.json,locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 14 | `../models/world-biota-blockchain.glb` | biota.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 15 | `../models/world-diagnostic-x.glb` | diagnostic.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 16 | `../models/world-empathic-x.glb` | empathic.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 17 | `../models/world-locator-x.glb` | locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 18 | `../models/zone-marker.glb` | biota.json,diagnostic.json,empathic.json,locator.json | **NOT FOUND** | — | — | — | — (needs new modelling / substitute decision) |
| 19 | `assets/Container.glb` | holodeck.json | FOUND (raw 200) | 654000 | `rp1/smartciti-holodeck/objects/Container.glb` | — | `assets/glb/Container.glb` |
| 20 | `cognition/models/campus.glb` | cognition.json | FOUND (raw 200) | 140564 | `worldforge/fabrics/assets/cognition-models/campus.glb` | — | `assets/glb/campus.glb` |
| 21 | `cognition/models/pack-basic-life-skills-self-reliance.glb` | cognition.json | FOUND (raw 200) | 28664 | `worldforge/fabrics/assets/cognition-models/pack-basic-life-skills-self-reliance.glb` | — | `assets/glb/pack-basic-life-skills-self-reliance.glb` |
| 22 | `cognition/models/pack-care-across-a-life.glb` | cognition.json | FOUND (raw 200) | 28620 | `worldforge/fabrics/assets/cognition-models/pack-care-across-a-life.glb` | — | `assets/glb/pack-care-across-a-life.glb` |
| 23 | `cognition/models/pack-civic-leadership.glb` | cognition.json | FOUND (raw 200) | 28620 | `worldforge/fabrics/assets/cognition-models/pack-civic-leadership.glb` | — | `assets/glb/pack-civic-leadership.glb` |
| 24 | `cognition/models/pack-community-relationship-practice.glb` | cognition.json | FOUND (raw 200) | 28652 | `worldforge/fabrics/assets/cognition-models/pack-community-relationship-practice.glb` | — | `assets/glb/pack-community-relationship-practice.glb` |
| 25 | `cognition/models/pack-corporate-os.glb` | cognition.json | FOUND (raw 200) | 81124 | `worldforge/fabrics/assets/cognition-models/pack-corporate-os.glb` | — | `assets/glb/pack-corporate-os.glb` |
| 26 | `cognition/models/pack-empathy-emotional-intelligence.glb` | cognition.json | FOUND (raw 200) | 28648 | `worldforge/fabrics/assets/cognition-models/pack-empathy-emotional-intelligence.glb` | — | `assets/glb/pack-empathy-emotional-intelligence.glb` |
| 27 | `cognition/models/pack-future-work.glb` | cognition.json | FOUND (raw 200) | 28620 | `worldforge/fabrics/assets/cognition-models/pack-future-work.glb` | — | `assets/glb/pack-future-work.glb` |
| 28 | `cognition/models/pack-global-health-os.glb` | cognition.json | FOUND (raw 200) | 81144 | `worldforge/fabrics/assets/cognition-models/pack-global-health-os.glb` | — | `assets/glb/pack-global-health-os.glb` |
| 29 | `cognition/models/pack-health-community.glb` | cognition.json | FOUND (raw 200) | 32964 | `worldforge/fabrics/assets/cognition-models/pack-health-community.glb` | — | `assets/glb/pack-health-community.glb` |
| 30 | `cognition/models/pack-housing-tenancy.glb` | cognition.json | FOUND (raw 200) | 45136 | `worldforge/fabrics/assets/cognition-models/pack-housing-tenancy.glb` | — | `assets/glb/pack-housing-tenancy.glb` |
| 31 | `cognition/models/pack-k-12.glb` | cognition.json | FOUND (raw 200) | 63180 | `worldforge/fabrics/assets/cognition-models/pack-k-12.glb` | — | `assets/glb/pack-k-12.glb` |
| 32 | `cognition/models/pack-language-culture-communication.glb` | cognition.json | FOUND (raw 200) | 28652 | `worldforge/fabrics/assets/cognition-models/pack-language-culture-communication.glb` | — | `assets/glb/pack-language-culture-communication.glb` |
| 33 | `cognition/models/pack-making-repair-reuse.glb` | cognition.json | FOUND (raw 200) | 28628 | `worldforge/fabrics/assets/cognition-models/pack-making-repair-reuse.glb` | — | `assets/glb/pack-making-repair-reuse.glb` |
| 34 | `cognition/models/pack-money-benefits-entitlements.glb` | cognition.json | FOUND (raw 200) | 45152 | `worldforge/fabrics/assets/cognition-models/pack-money-benefits-entitlements.glb` | — | `assets/glb/pack-money-benefits-entitlements.glb` |
| 35 | `cognition/models/pack-multilateral-os.glb` | cognition.json | FOUND (raw 200) | 81128 | `worldforge/fabrics/assets/cognition-models/pack-multilateral-os.glb` | — | `assets/glb/pack-multilateral-os.glb` |
| 36 | `cognition/models/pack-neighbourhood-safety-civic-voice.glb` | cognition.json | FOUND (raw 200) | 45164 | `worldforge/fabrics/assets/cognition-models/pack-neighbourhood-safety-civic-voice.glb` | — | `assets/glb/pack-neighbourhood-safety-civic-voice.glb` |
| 37 | `cognition/models/pack-non-profit-practice.glb` | cognition.json | FOUND (raw 200) | 81124 | `worldforge/fabrics/assets/cognition-models/pack-non-profit-practice.glb` | — | `assets/glb/pack-non-profit-practice.glb` |
| 38 | `cognition/models/pack-preventive-health-everyday-care.glb` | cognition.json | FOUND (raw 200) | 28652 | `worldforge/fabrics/assets/cognition-models/pack-preventive-health-everyday-care.glb` | — | `assets/glb/pack-preventive-health-everyday-care.glb` |
| 39 | `cognition/models/pack-reentry-recovery-pathways.glb` | cognition.json | FOUND (raw 200) | 45160 | `worldforge/fabrics/assets/cognition-models/pack-reentry-recovery-pathways.glb` | — | `assets/glb/pack-reentry-recovery-pathways.glb` |
| 40 | `cognition/models/pack-regional.glb` | cognition.json | FOUND (raw 200) | 67512 | `worldforge/fabrics/assets/cognition-models/pack-regional.glb` | — | `assets/glb/pack-regional.glb` |
| 41 | `cognition/models/pack-robotics-os.glb` | cognition.json | FOUND (raw 200) | 81120 | `worldforge/fabrics/assets/cognition-models/pack-robotics-os.glb` | — | `assets/glb/pack-robotics-os.glb` |
| 42 | `cognition/models/pack-sapient-os.glb` | cognition.json | FOUND (raw 200) | 81132 | `worldforge/fabrics/assets/cognition-models/pack-sapient-os.glb` | — | `assets/glb/pack-sapient-os.glb` |
| 43 | `cognition/models/pack-science-os.glb` | cognition.json | FOUND (raw 200) | 81132 | `worldforge/fabrics/assets/cognition-models/pack-science-os.glb` | — | `assets/glb/pack-science-os.glb` |
| 44 | `cognition/models/pack-trade-school.glb` | cognition.json | FOUND (raw 200) | 11292 | `worldforge/fabrics/assets/cognition-models/pack-trade-school.glb` | — | `assets/glb/pack-trade-school.glb` |
| 45 | `cognition/models/pack-water-land-climate.glb` | cognition.json | FOUND (raw 200) | 28628 | `worldforge/fabrics/assets/cognition-models/pack-water-land-climate.glb` | — | `assets/glb/pack-water-land-climate.glb` |
| 46 | `holodeck/models/deck.glb` | holodeck.json | FOUND (raw 200) | 87372 | `worldforge/fabrics/assets/holodeck-models/deck.glb` | `rp1/smartciti-holodeck/objects/deck.glb` | `assets/glb/deck.glb` |
| 47 | `holodeck/models/hall-acoustic.glb` | holodeck.json | FOUND (raw 200) | 53840 | `worldforge/fabrics/assets/holodeck-models/hall-acoustic.glb` | `rp1/smartciti-holodeck/objects/hall-acoustic.glb` | `assets/glb/hall-acoustic.glb` |
| 48 | `holodeck/models/hall-airfield.glb` | holodeck.json | FOUND (raw 200) | 53840 | `worldforge/fabrics/assets/holodeck-models/hall-airfield.glb` | `rp1/smartciti-holodeck/objects/hall-airfield.glb` | `assets/glb/hall-airfield.glb` |
| 49 | `holodeck/models/hall-asbestos.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-asbestos.glb` | `rp1/smartciti-holodeck/objects/hall-asbestos.glb` | `assets/glb/hall-asbestos.glb` |
| 50 | `holodeck/models/hall-automation-int.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-automation-int.glb` | `rp1/smartciti-holodeck/objects/hall-automation-int.glb` | `assets/glb/hall-automation-int.glb` |
| 51 | `holodeck/models/hall-aviation-ground.glb` | holodeck.json | FOUND (raw 200) | 53856 | `worldforge/fabrics/assets/holodeck-models/hall-aviation-ground.glb` | `rp1/smartciti-holodeck/objects/hall-aviation-ground.glb` | `assets/glb/hall-aviation-ground.glb` |
| 52 | `holodeck/models/hall-bas-controls.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-bas-controls.glb` | `rp1/smartciti-holodeck/objects/hall-bas-controls.glb` | `assets/glb/hall-bas-controls.glb` |
| 53 | `holodeck/models/hall-battery-storage.glb` | holodeck.json | FOUND (raw 200) | 53864 | `worldforge/fabrics/assets/holodeck-models/hall-battery-storage.glb` | `rp1/smartciti-holodeck/objects/hall-battery-storage.glb` | `assets/glb/hall-battery-storage.glb` |
| 54 | `holodeck/models/hall-blasters.glb` | holodeck.json | FOUND (raw 200) | 53840 | `worldforge/fabrics/assets/holodeck-models/hall-blasters.glb` | `rp1/smartciti-holodeck/objects/hall-blasters.glb` | `assets/glb/hall-blasters.glb` |
| 55 | `holodeck/models/hall-boilermakers.glb` | holodeck.json | FOUND (raw 200) | 53816 | `worldforge/fabrics/assets/holodeck-models/hall-boilermakers.glb` | `rp1/smartciti-holodeck/objects/hall-boilermakers.glb` | `assets/glb/hall-boilermakers.glb` |
| 56 | `holodeck/models/hall-bricklayers.glb` | holodeck.json | FOUND (raw 200) | 59548 | `worldforge/fabrics/assets/holodeck-models/hall-bricklayers.glb` | `rp1/smartciti-holodeck/objects/hall-bricklayers.glb` | `assets/glb/hall-bricklayers.glb` |
| 57 | `holodeck/models/hall-bridge-inspect.glb` | holodeck.json | FOUND (raw 200) | 53860 | `worldforge/fabrics/assets/holodeck-models/hall-bridge-inspect.glb` | `rp1/smartciti-holodeck/objects/hall-bridge-inspect.glb` | `assets/glb/hall-bridge-inspect.glb` |
| 58 | `holodeck/models/hall-cable-splicers.glb` | holodeck.json | FOUND (raw 200) | 53840 | `worldforge/fabrics/assets/holodeck-models/hall-cable-splicers.glb` | `rp1/smartciti-holodeck/objects/hall-cable-splicers.glb` | `assets/glb/hall-cable-splicers.glb` |
| 59 | `holodeck/models/hall-carpenters.glb` | holodeck.json | FOUND (raw 200) | 53820 | `worldforge/fabrics/assets/holodeck-models/hall-carpenters.glb` | `rp1/smartciti-holodeck/objects/hall-carpenters.glb` | `assets/glb/hall-carpenters.glb` |
| 60 | `holodeck/models/hall-catenary.glb` | holodeck.json | FOUND (raw 200) | 53860 | `worldforge/fabrics/assets/holodeck-models/hall-catenary.glb` | `rp1/smartciti-holodeck/objects/hall-catenary.glb` | `assets/glb/hall-catenary.glb` |
| 61 | `holodeck/models/hall-cement-masons.glb` | holodeck.json | FOUND (raw 200) | 55248 | `worldforge/fabrics/assets/holodeck-models/hall-cement-masons.glb` | `rp1/smartciti-holodeck/objects/hall-cement-masons.glb` | `assets/glb/hall-cement-masons.glb` |
| 62 | `holodeck/models/hall-cladding.glb` | holodeck.json | FOUND (raw 200) | 53856 | `worldforge/fabrics/assets/holodeck-models/hall-cladding.glb` | `rp1/smartciti-holodeck/objects/hall-cladding.glb` | `assets/glb/hall-cladding.glb` |
| 63 | `holodeck/models/hall-cleanroom.glb` | holodeck.json | FOUND (raw 200) | 53832 | `worldforge/fabrics/assets/holodeck-models/hall-cleanroom.glb` | `rp1/smartciti-holodeck/objects/hall-cleanroom.glb` | `assets/glb/hall-cleanroom.glb` |
| 64 | `holodeck/models/hall-concrete-pump.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-concrete-pump.glb` | `rp1/smartciti-holodeck/objects/hall-concrete-pump.glb` | `assets/glb/hall-concrete-pump.glb` |
| 65 | `holodeck/models/hall-confined-space.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-confined-space.glb` | `rp1/smartciti-holodeck/objects/hall-confined-space.glb` | `assets/glb/hall-confined-space.glb` |
| 66 | `holodeck/models/hall-crane-ops.glb` | holodeck.json | FOUND (raw 200) | 53820 | `worldforge/fabrics/assets/holodeck-models/hall-crane-ops.glb` | `rp1/smartciti-holodeck/objects/hall-crane-ops.glb` | `assets/glb/hall-crane-ops.glb` |
| 67 | `holodeck/models/hall-curtainwall.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-curtainwall.glb` | `rp1/smartciti-holodeck/objects/hall-curtainwall.glb` | `assets/glb/hall-curtainwall.glb` |
| 68 | `holodeck/models/hall-data-center.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-data-center.glb` | `rp1/smartciti-holodeck/objects/hall-data-center.glb` | `assets/glb/hall-data-center.glb` |
| 69 | `holodeck/models/hall-decking.glb` | holodeck.json | FOUND (raw 200) | 53836 | `worldforge/fabrics/assets/holodeck-models/hall-decking.glb` | `rp1/smartciti-holodeck/objects/hall-decking.glb` | `assets/glb/hall-decking.glb` |
| 70 | `holodeck/models/hall-demolition.glb` | holodeck.json | FOUND (raw 200) | 53836 | `worldforge/fabrics/assets/holodeck-models/hall-demolition.glb` | `rp1/smartciti-holodeck/objects/hall-demolition.glb` | `assets/glb/hall-demolition.glb` |
| 71 | `holodeck/models/hall-district-energy.glb` | holodeck.json | FOUND (raw 200) | 53864 | `worldforge/fabrics/assets/holodeck-models/hall-district-energy.glb` | `rp1/smartciti-holodeck/objects/hall-district-energy.glb` | `assets/glb/hall-district-energy.glb` |
| 72 | `holodeck/models/hall-divers.glb` | holodeck.json | FOUND (raw 200) | 53832 | `worldforge/fabrics/assets/holodeck-models/hall-divers.glb` | `rp1/smartciti-holodeck/objects/hall-divers.glb` | `assets/glb/hall-divers.glb` |
| 73 | `holodeck/models/hall-drywall.glb` | holodeck.json | FOUND (raw 200) | 53836 | `worldforge/fabrics/assets/holodeck-models/hall-drywall.glb` | `rp1/smartciti-holodeck/objects/hall-drywall.glb` | `assets/glb/hall-drywall.glb` |
| 74 | `holodeck/models/hall-electricians.glb` | holodeck.json | FOUND (raw 200) | 53840 | `worldforge/fabrics/assets/holodeck-models/hall-electricians.glb` | `rp1/smartciti-holodeck/objects/hall-electricians.glb` | `assets/glb/hall-electricians.glb` |
| 75 | `holodeck/models/hall-elevator.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-elevator.glb` | `rp1/smartciti-holodeck/objects/hall-elevator.glb` | `assets/glb/hall-elevator.glb` |
| 76 | `holodeck/models/hall-ev-charging.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-ev-charging.glb` | `rp1/smartciti-holodeck/objects/hall-ev-charging.glb` | `assets/glb/hall-ev-charging.glb` |
| 77 | `holodeck/models/hall-fabricators.glb` | holodeck.json | FOUND (raw 200) | 53836 | `worldforge/fabrics/assets/holodeck-models/hall-fabricators.glb` | `rp1/smartciti-holodeck/objects/hall-fabricators.glb` | `assets/glb/hall-fabricators.glb` |
| 78 | `holodeck/models/hall-fiber-splicers.glb` | holodeck.json | FOUND (raw 200) | 53832 | `worldforge/fabrics/assets/holodeck-models/hall-fiber-splicers.glb` | `rp1/smartciti-holodeck/objects/hall-fiber-splicers.glb` | `assets/glb/hall-fiber-splicers.glb` |
| 79 | `holodeck/models/hall-fire-alarm.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-fire-alarm.glb` | `rp1/smartciti-holodeck/objects/hall-fire-alarm.glb` | `assets/glb/hall-fire-alarm.glb` |
| 80 | `holodeck/models/hall-fire-sprinkler.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-fire-sprinkler.glb` | `rp1/smartciti-holodeck/objects/hall-fire-sprinkler.glb` | `assets/glb/hall-fire-sprinkler.glb` |
| 81 | `holodeck/models/hall-firestop.glb` | holodeck.json | FOUND (raw 200) | 53840 | `worldforge/fabrics/assets/holodeck-models/hall-firestop.glb` | `rp1/smartciti-holodeck/objects/hall-firestop.glb` | `assets/glb/hall-firestop.glb` |
| 82 | `holodeck/models/hall-fleet-diesel.glb` | holodeck.json | FOUND (raw 200) | 53860 | `worldforge/fabrics/assets/holodeck-models/hall-fleet-diesel.glb` | `rp1/smartciti-holodeck/objects/hall-fleet-diesel.glb` | `assets/glb/hall-fleet-diesel.glb` |
| 83 | `holodeck/models/hall-flooring.glb` | holodeck.json | FOUND (raw 200) | 53828 | `worldforge/fabrics/assets/holodeck-models/hall-flooring.glb` | `rp1/smartciti-holodeck/objects/hall-flooring.glb` | `assets/glb/hall-flooring.glb` |
| 84 | `holodeck/models/hall-foundry.glb` | holodeck.json | FOUND (raw 200) | 53828 | `worldforge/fabrics/assets/holodeck-models/hall-foundry.glb` | `rp1/smartciti-holodeck/objects/hall-foundry.glb` | `assets/glb/hall-foundry.glb` |
| 85 | `holodeck/models/hall-gas-distrib.glb` | holodeck.json | FOUND (raw 200) | 53856 | `worldforge/fabrics/assets/holodeck-models/hall-gas-distrib.glb` | `rp1/smartciti-holodeck/objects/hall-gas-distrib.glb` | `assets/glb/hall-gas-distrib.glb` |
| 86 | `holodeck/models/hall-geothermal.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-geothermal.glb` | `rp1/smartciti-holodeck/objects/hall-geothermal.glb` | `assets/glb/hall-geothermal.glb` |
| 87 | `holodeck/models/hall-glaziers.glb` | holodeck.json | FOUND (raw 200) | 53816 | `worldforge/fabrics/assets/holodeck-models/hall-glaziers.glb` | `rp1/smartciti-holodeck/objects/hall-glaziers.glb` | `assets/glb/hall-glaziers.glb` |
| 88 | `holodeck/models/hall-grounds.glb` | holodeck.json | FOUND (raw 200) | 53836 | `worldforge/fabrics/assets/holodeck-models/hall-grounds.glb` | `rp1/smartciti-holodeck/objects/hall-grounds.glb` | `assets/glb/hall-grounds.glb` |
| 89 | `holodeck/models/hall-hazmat.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-hazmat.glb` | `rp1/smartciti-holodeck/objects/hall-hazmat.glb` | `assets/glb/hall-hazmat.glb` |
| 90 | `holodeck/models/hall-heavy-equip.glb` | holodeck.json | FOUND (raw 200) | 53856 | `worldforge/fabrics/assets/holodeck-models/hall-heavy-equip.glb` | `rp1/smartciti-holodeck/objects/hall-heavy-equip.glb` | `assets/glb/hall-heavy-equip.glb` |
| 91 | `holodeck/models/hall-high-angle.glb` | holodeck.json | FOUND (raw 200) | 53836 | `worldforge/fabrics/assets/holodeck-models/hall-high-angle.glb` | `rp1/smartciti-holodeck/objects/hall-high-angle.glb` | `assets/glb/hall-high-angle.glb` |
| 92 | `holodeck/models/hall-hvacr.glb` | holodeck.json | FOUND (raw 200) | 53840 | `worldforge/fabrics/assets/holodeck-models/hall-hvacr.glb` | `rp1/smartciti-holodeck/objects/hall-hvacr.glb` | `assets/glb/hall-hvacr.glb` |
| 93 | `holodeck/models/hall-hydro.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-hydro.glb` | `rp1/smartciti-holodeck/objects/hall-hydro.glb` | `assets/glb/hall-hydro.glb` |
| 94 | `holodeck/models/hall-hydrogen.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-hydrogen.glb` | `rp1/smartciti-holodeck/objects/hall-hydrogen.glb` | `assets/glb/hall-hydrogen.glb` |
| 95 | `holodeck/models/hall-industrial-clean.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-industrial-clean.glb` | `rp1/smartciti-holodeck/objects/hall-industrial-clean.glb` | `assets/glb/hall-industrial-clean.glb` |
| 96 | `holodeck/models/hall-instrumentation.glb` | holodeck.json | FOUND (raw 200) | 53856 | `worldforge/fabrics/assets/holodeck-models/hall-instrumentation.glb` | `rp1/smartciti-holodeck/objects/hall-instrumentation.glb` | `assets/glb/hall-instrumentation.glb` |
| 97 | `holodeck/models/hall-insulators.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-insulators.glb` | `rp1/smartciti-holodeck/objects/hall-insulators.glb` | `assets/glb/hall-insulators.glb` |
| 98 | `holodeck/models/hall-ironworkers.glb` | holodeck.json | FOUND (raw 200) | 53812 | `worldforge/fabrics/assets/holodeck-models/hall-ironworkers.glb` | `rp1/smartciti-holodeck/objects/hall-ironworkers.glb` | `assets/glb/hall-ironworkers.glb` |
| 99 | `holodeck/models/hall-laborers.glb` | holodeck.json | FOUND (raw 200) | 53812 | `worldforge/fabrics/assets/holodeck-models/hall-laborers.glb` | `rp1/smartciti-holodeck/objects/hall-laborers.glb` | `assets/glb/hall-laborers.glb` |
| 100 | `holodeck/models/hall-lathers.glb` | holodeck.json | FOUND (raw 200) | 55240 | `worldforge/fabrics/assets/holodeck-models/hall-lathers.glb` | `rp1/smartciti-holodeck/objects/hall-lathers.glb` | `assets/glb/hall-lathers.glb` |
| 101 | `holodeck/models/hall-lead-abatement.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-lead-abatement.glb` | `rp1/smartciti-holodeck/objects/hall-lead-abatement.glb` | `assets/glb/hall-lead-abatement.glb` |
| 102 | `holodeck/models/hall-line-workers.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-line-workers.glb` | `rp1/smartciti-holodeck/objects/hall-line-workers.glb` | `assets/glb/hall-line-workers.glb` |
| 103 | `holodeck/models/hall-machinists.glb` | holodeck.json | FOUND (raw 200) | 53820 | `worldforge/fabrics/assets/holodeck-models/hall-machinists.glb` | `rp1/smartciti-holodeck/objects/hall-machinists.glb` | `assets/glb/hall-machinists.glb` |
| 104 | `holodeck/models/hall-marine-pipe.glb` | holodeck.json | FOUND (raw 200) | 53836 | `worldforge/fabrics/assets/holodeck-models/hall-marine-pipe.glb` | `rp1/smartciti-holodeck/objects/hall-marine-pipe.glb` | `assets/glb/hall-marine-pipe.glb` |
| 105 | `holodeck/models/hall-marine-terminal.glb` | holodeck.json | FOUND (raw 200) | 53860 | `worldforge/fabrics/assets/holodeck-models/hall-marine-terminal.glb` | `rp1/smartciti-holodeck/objects/hall-marine-terminal.glb` | `assets/glb/hall-marine-terminal.glb` |
| 106 | `holodeck/models/hall-masonry-restore.glb` | holodeck.json | FOUND (raw 200) | 57384 | `worldforge/fabrics/assets/holodeck-models/hall-masonry-restore.glb` | `rp1/smartciti-holodeck/objects/hall-masonry-restore.glb` | `assets/glb/hall-masonry-restore.glb` |
| 107 | `holodeck/models/hall-medical-gas.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-medical-gas.glb` | `rp1/smartciti-holodeck/objects/hall-medical-gas.glb` | `assets/glb/hall-medical-gas.glb` |
| 108 | `holodeck/models/hall-meter-techs.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-meter-techs.glb` | `rp1/smartciti-holodeck/objects/hall-meter-techs.glb` | `assets/glb/hall-meter-techs.glb` |
| 109 | `holodeck/models/hall-millwrights.glb` | holodeck.json | FOUND (raw 200) | 53816 | `worldforge/fabrics/assets/holodeck-models/hall-millwrights.glb` | `rp1/smartciti-holodeck/objects/hall-millwrights.glb` | `assets/glb/hall-millwrights.glb` |
| 110 | `holodeck/models/hall-miners.glb` | holodeck.json | FOUND (raw 200) | 53832 | `worldforge/fabrics/assets/holodeck-models/hall-miners.glb` | `rp1/smartciti-holodeck/objects/hall-miners.glb` | `assets/glb/hall-miners.glb` |
| 111 | `holodeck/models/hall-mold-remediation.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-mold-remediation.glb` | `rp1/smartciti-holodeck/objects/hall-mold-remediation.glb` | `assets/glb/hall-mold-remediation.glb` |
| 112 | `holodeck/models/hall-network-cabling.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-network-cabling.glb` | `rp1/smartciti-holodeck/objects/hall-network-cabling.glb` | `assets/glb/hall-network-cabling.glb` |
| 113 | `holodeck/models/hall-nuclear.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-nuclear.glb` | `rp1/smartciti-holodeck/objects/hall-nuclear.glb` | `assets/glb/hall-nuclear.glb` |
| 114 | `holodeck/models/hall-operating-eng.glb` | holodeck.json | FOUND (raw 200) | 53836 | `worldforge/fabrics/assets/holodeck-models/hall-operating-eng.glb` | `rp1/smartciti-holodeck/objects/hall-operating-eng.glb` | `assets/glb/hall-operating-eng.glb` |
| 115 | `holodeck/models/hall-painters.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-painters.glb` | `rp1/smartciti-holodeck/objects/hall-painters.glb` | `assets/glb/hall-painters.glb` |
| 116 | `holodeck/models/hall-piling.glb` | holodeck.json | FOUND (raw 200) | 53812 | `worldforge/fabrics/assets/holodeck-models/hall-piling.glb` | `rp1/smartciti-holodeck/objects/hall-piling.glb` | `assets/glb/hall-piling.glb` |
| 117 | `holodeck/models/hall-pipefitters.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-pipefitters.glb` | `rp1/smartciti-holodeck/objects/hall-pipefitters.glb` | `assets/glb/hall-pipefitters.glb` |
| 118 | `holodeck/models/hall-pipeline.glb` | holodeck.json | FOUND (raw 200) | 53828 | `worldforge/fabrics/assets/holodeck-models/hall-pipeline.glb` | `rp1/smartciti-holodeck/objects/hall-pipeline.glb` | `assets/glb/hall-pipeline.glb` |
| 119 | `holodeck/models/hall-plasterers.glb` | holodeck.json | FOUND (raw 200) | 53820 | `worldforge/fabrics/assets/holodeck-models/hall-plasterers.glb` | `rp1/smartciti-holodeck/objects/hall-plasterers.glb` | `assets/glb/hall-plasterers.glb` |
| 120 | `holodeck/models/hall-platers.glb` | holodeck.json | FOUND (raw 200) | 53832 | `worldforge/fabrics/assets/holodeck-models/hall-platers.glb` | `rp1/smartciti-holodeck/objects/hall-platers.glb` | `assets/glb/hall-platers.glb` |
| 121 | `holodeck/models/hall-plc-techs.glb` | holodeck.json | FOUND (raw 200) | 53856 | `worldforge/fabrics/assets/holodeck-models/hall-plc-techs.glb` | `rp1/smartciti-holodeck/objects/hall-plc-techs.glb` | `assets/glb/hall-plc-techs.glb` |
| 122 | `holodeck/models/hall-port-crane.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-port-crane.glb` | `rp1/smartciti-holodeck/objects/hall-port-crane.glb` | `assets/glb/hall-port-crane.glb` |
| 123 | `holodeck/models/hall-post-tension.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-post-tension.glb` | `rp1/smartciti-holodeck/objects/hall-post-tension.glb` | `assets/glb/hall-post-tension.glb` |
| 124 | `holodeck/models/hall-precast.glb` | holodeck.json | FOUND (raw 200) | 53820 | `worldforge/fabrics/assets/holodeck-models/hall-precast.glb` | `rp1/smartciti-holodeck/objects/hall-precast.glb` | `assets/glb/hall-precast.glb` |
| 125 | `holodeck/models/hall-rail-signals.glb` | holodeck.json | FOUND (raw 200) | 53860 | `worldforge/fabrics/assets/holodeck-models/hall-rail-signals.glb` | `rp1/smartciti-holodeck/objects/hall-rail-signals.glb` | `assets/glb/hall-rail-signals.glb` |
| 126 | `holodeck/models/hall-rail-track.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-rail-track.glb` | `rp1/smartciti-holodeck/objects/hall-rail-track.glb` | `assets/glb/hall-rail-track.glb` |
| 127 | `holodeck/models/hall-refractory.glb` | holodeck.json | FOUND (raw 200) | 55200 | `worldforge/fabrics/assets/holodeck-models/hall-refractory.glb` | `rp1/smartciti-holodeck/objects/hall-refractory.glb` | `assets/glb/hall-refractory.glb` |
| 128 | `holodeck/models/hall-riggers.glb` | holodeck.json | FOUND (raw 200) | 55208 | `worldforge/fabrics/assets/holodeck-models/hall-riggers.glb` | `rp1/smartciti-holodeck/objects/hall-riggers.glb` | `assets/glb/hall-riggers.glb` |
| 129 | `holodeck/models/hall-robotics.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-robotics.glb` | `rp1/smartciti-holodeck/objects/hall-robotics.glb` | `assets/glb/hall-robotics.glb` |
| 130 | `holodeck/models/hall-roofers.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-roofers.glb` | `rp1/smartciti-holodeck/objects/hall-roofers.glb` | `assets/glb/hall-roofers.glb` |
| 131 | `holodeck/models/hall-scaffold.glb` | holodeck.json | FOUND (raw 200) | 55200 | `worldforge/fabrics/assets/holodeck-models/hall-scaffold.glb` | `rp1/smartciti-holodeck/objects/hall-scaffold.glb` | `assets/glb/hall-scaffold.glb` |
| 132 | `holodeck/models/hall-security-sys.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-security-sys.glb` | `rp1/smartciti-holodeck/objects/hall-security-sys.glb` | `assets/glb/hall-security-sys.glb` |
| 133 | `holodeck/models/hall-sheetmetal.glb` | holodeck.json | FOUND (raw 200) | 53840 | `worldforge/fabrics/assets/holodeck-models/hall-sheetmetal.glb` | `rp1/smartciti-holodeck/objects/hall-sheetmetal.glb` | `assets/glb/hall-sheetmetal.glb` |
| 134 | `holodeck/models/hall-shipfitters.glb` | holodeck.json | FOUND (raw 200) | 53816 | `worldforge/fabrics/assets/holodeck-models/hall-shipfitters.glb` | `rp1/smartciti-holodeck/objects/hall-shipfitters.glb` | `assets/glb/hall-shipfitters.glb` |
| 135 | `holodeck/models/hall-shoring.glb` | holodeck.json | FOUND (raw 200) | 53840 | `worldforge/fabrics/assets/holodeck-models/hall-shoring.glb` | `rp1/smartciti-holodeck/objects/hall-shoring.glb` | `assets/glb/hall-shoring.glb` |
| 136 | `holodeck/models/hall-site-safety.glb` | holodeck.json | FOUND (raw 200) | 55216 | `worldforge/fabrics/assets/holodeck-models/hall-site-safety.glb` | `rp1/smartciti-holodeck/objects/hall-site-safety.glb` | `assets/glb/hall-site-safety.glb` |
| 137 | `holodeck/models/hall-smelter.glb` | holodeck.json | FOUND (raw 200) | 53828 | `worldforge/fabrics/assets/holodeck-models/hall-smelter.glb` | `rp1/smartciti-holodeck/objects/hall-smelter.glb` | `assets/glb/hall-smelter.glb` |
| 138 | `holodeck/models/hall-solar.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-solar.glb` | `rp1/smartciti-holodeck/objects/hall-solar.glb` | `assets/glb/hall-solar.glb` |
| 139 | `holodeck/models/hall-spill-response.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-spill-response.glb` | `rp1/smartciti-holodeck/objects/hall-spill-response.glb` | `assets/glb/hall-spill-response.glb` |
| 140 | `holodeck/models/hall-steel-erectors.glb` | holodeck.json | FOUND (raw 200) | 53820 | `worldforge/fabrics/assets/holodeck-models/hall-steel-erectors.glb` | `rp1/smartciti-holodeck/objects/hall-steel-erectors.glb` | `assets/glb/hall-steel-erectors.glb` |
| 141 | `holodeck/models/hall-stone-carvers.glb` | holodeck.json | FOUND (raw 200) | 55952 | `worldforge/fabrics/assets/holodeck-models/hall-stone-carvers.glb` | `rp1/smartciti-holodeck/objects/hall-stone-carvers.glb` | `assets/glb/hall-stone-carvers.glb` |
| 142 | `holodeck/models/hall-substation.glb` | holodeck.json | FOUND (raw 200) | 53856 | `worldforge/fabrics/assets/holodeck-models/hall-substation.glb` | `rp1/smartciti-holodeck/objects/hall-substation.glb` | `assets/glb/hall-substation.glb` |
| 143 | `holodeck/models/hall-survey-drone.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-survey-drone.glb` | `rp1/smartciti-holodeck/objects/hall-survey-drone.glb` | `assets/glb/hall-survey-drone.glb` |
| 144 | `holodeck/models/hall-surveyors.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-surveyors.glb` | `rp1/smartciti-holodeck/objects/hall-surveyors.glb` | `assets/glb/hall-surveyors.glb` |
| 145 | `holodeck/models/hall-tank-erectors.glb` | holodeck.json | FOUND (raw 200) | 53824 | `worldforge/fabrics/assets/holodeck-models/hall-tank-erectors.glb` | `rp1/smartciti-holodeck/objects/hall-tank-erectors.glb` | `assets/glb/hall-tank-erectors.glb` |
| 146 | `holodeck/models/hall-teamsters.glb` | holodeck.json | FOUND (raw 200) | 53820 | `worldforge/fabrics/assets/holodeck-models/hall-teamsters.glb` | `rp1/smartciti-holodeck/objects/hall-teamsters.glb` | `assets/glb/hall-teamsters.glb` |
| 147 | `holodeck/models/hall-terrazzo.glb` | holodeck.json | FOUND (raw 200) | 53832 | `worldforge/fabrics/assets/holodeck-models/hall-terrazzo.glb` | `rp1/smartciti-holodeck/objects/hall-terrazzo.glb` | `assets/glb/hall-terrazzo.glb` |
| 148 | `holodeck/models/hall-tilesetters.glb` | holodeck.json | FOUND (raw 200) | 55220 | `worldforge/fabrics/assets/holodeck-models/hall-tilesetters.glb` | `rp1/smartciti-holodeck/objects/hall-tilesetters.glb` | `assets/glb/hall-tilesetters.glb` |
| 149 | `holodeck/models/hall-toolmakers.glb` | holodeck.json | FOUND (raw 200) | 53832 | `worldforge/fabrics/assets/holodeck-models/hall-toolmakers.glb` | `rp1/smartciti-holodeck/objects/hall-toolmakers.glb` | `assets/glb/hall-toolmakers.glb` |
| 150 | `holodeck/models/hall-transit-vehicle.glb` | holodeck.json | FOUND (raw 200) | 53868 | `worldforge/fabrics/assets/holodeck-models/hall-transit-vehicle.glb` | `rp1/smartciti-holodeck/objects/hall-transit-vehicle.glb` | `assets/glb/hall-transit-vehicle.glb` |
| 151 | `holodeck/models/hall-transmission.glb` | holodeck.json | FOUND (raw 200) | 53848 | `worldforge/fabrics/assets/holodeck-models/hall-transmission.glb` | `rp1/smartciti-holodeck/objects/hall-transmission.glb` | `assets/glb/hall-transmission.glb` |
| 152 | `holodeck/models/hall-wastewater.glb` | holodeck.json | FOUND (raw 200) | 53852 | `worldforge/fabrics/assets/holodeck-models/hall-wastewater.glb` | `rp1/smartciti-holodeck/objects/hall-wastewater.glb` | `assets/glb/hall-wastewater.glb` |
| 153 | `holodeck/models/hall-water-distrib.glb` | holodeck.json | FOUND (raw 200) | 53864 | `worldforge/fabrics/assets/holodeck-models/hall-water-distrib.glb` | `rp1/smartciti-holodeck/objects/hall-water-distrib.glb` | `assets/glb/hall-water-distrib.glb` |
| 154 | `holodeck/models/hall-waterproofers.glb` | holodeck.json | FOUND (raw 200) | 55976 | `worldforge/fabrics/assets/holodeck-models/hall-waterproofers.glb` | `rp1/smartciti-holodeck/objects/hall-waterproofers.glb` | `assets/glb/hall-waterproofers.glb` |
| 155 | `holodeck/models/hall-welders.glb` | holodeck.json | FOUND (raw 200) | 53820 | `worldforge/fabrics/assets/holodeck-models/hall-welders.glb` | `rp1/smartciti-holodeck/objects/hall-welders.glb` | `assets/glb/hall-welders.glb` |
| 156 | `holodeck/models/hall-wind.glb` | holodeck.json | FOUND (raw 200) | 53856 | `worldforge/fabrics/assets/holodeck-models/hall-wind.glb` | `rp1/smartciti-holodeck/objects/hall-wind.glb` | `assets/glb/hall-wind.glb` |
| 157 | `holodeck/models/hall-window-glazing.glb` | holodeck.json | FOUND (raw 200) | 53844 | `worldforge/fabrics/assets/holodeck-models/hall-window-glazing.glb` | `rp1/smartciti-holodeck/objects/hall-window-glazing.glb` | `assets/glb/hall-window-glazing.glb` |
| 158 | `holodeck/sims/sim-airless-sprayer.glb` | holodeck.json | FOUND (raw 200) | 14336 | `rp1/smartciti-holodeck/objects/sim-airless-sprayer.glb` | `rp1/holodeck-simulator-yard/objects/sim-airless-sprayer.glb` | `assets/glb/sim-airless-sprayer.glb` |
| 159 | `holodeck/sims/sim-boom-lift.glb` | holodeck.json | FOUND (raw 200) | 26088 | `rp1/smartciti-holodeck/objects/sim-boom-lift.glb` | `rp1/holodeck-simulator-yard/objects/sim-boom-lift.glb` | `assets/glb/sim-boom-lift.glb` |
| 160 | `holodeck/sims/sim-crane-lift.glb` | holodeck.json | FOUND (raw 200) | 108972 | `rp1/smartciti-holodeck/objects/sim-crane-lift.glb` | `rp1/holodeck-simulator-yard/objects/sim-crane-lift.glb` | `assets/glb/sim-crane-lift.glb` |
| 161 | `holodeck/sims/sim-excavator-trench.glb` | holodeck.json | FOUND (raw 200) | 22548 | `rp1/smartciti-holodeck/objects/sim-excavator-trench.glb` | `rp1/holodeck-simulator-yard/objects/sim-excavator-trench.glb` | `assets/glb/sim-excavator-trench.glb` |
| 162 | `holodeck/sims/sim-forklift-run.glb` | holodeck.json | FOUND (raw 200) | 74532 | `rp1/smartciti-holodeck/objects/sim-forklift-run.glb` | `rp1/holodeck-simulator-yard/objects/sim-forklift-run.glb` | `assets/glb/sim-forklift-run.glb` |
| 163 | `holodeck/sims/sim-load-chart.glb` | holodeck.json | FOUND (raw 200) | 23104 | `rp1/smartciti-holodeck/objects/sim-load-chart.glb` | `rp1/holodeck-simulator-yard/objects/sim-load-chart.glb` | `assets/glb/sim-load-chart.glb` |
| 164 | `holodeck/sims/sim-overhead-crane.glb` | holodeck.json | FOUND (raw 200) | 42900 | `rp1/smartciti-holodeck/objects/sim-overhead-crane.glb` | `rp1/holodeck-simulator-yard/objects/sim-overhead-crane.glb` | `assets/glb/sim-overhead-crane.glb` |
| 165 | `holodeck/sims/sim-pressure-washer.glb` | holodeck.json | FOUND (raw 200) | 11884 | `rp1/smartciti-holodeck/objects/sim-pressure-washer.glb` | `rp1/holodeck-simulator-yard/objects/sim-pressure-washer.glb` | `assets/glb/sim-pressure-washer.glb` |
| 166 | `holodeck/sims/sim-rigging-signals.glb` | holodeck.json | FOUND (raw 200) | 17556 | `rp1/smartciti-holodeck/objects/sim-rigging-signals.glb` | `rp1/holodeck-simulator-yard/objects/sim-rigging-signals.glb` | `assets/glb/sim-rigging-signals.glb` |
| 167 | `holodeck/sims/sim-scaffold-bay.glb` | holodeck.json | FOUND (raw 200) | 29416 | `rp1/smartciti-holodeck/objects/sim-scaffold-bay.glb` | `rp1/holodeck-simulator-yard/objects/sim-scaffold-bay.glb` | `assets/glb/sim-scaffold-bay.glb` |
| 168 | `holodeck/sims/sim-weld-bead.glb` | holodeck.json | FOUND (raw 200) | 18544 | `rp1/smartciti-holodeck/objects/sim-weld-bead.glb` | `rp1/holodeck-simulator-yard/objects/sim-weld-bead.glb` | `assets/glb/sim-weld-bead.glb` |

## 3. 100% agentic

### 3.1 Companion mapping — every flagship, real agents only

Each flagship has 2 companions (14 total). Companions are game characters REPRESENTING the real Virtuals agents; their `role` text and new `greeting` field cite only real ACP jobs/prices from `agents.json` (verified 2026-11-06) and state the live instance is offline. All 5 agents appear across the 7 worlds.

| World | Companions | Jobs cited in greetings (real ACP, USDC) |
|---|---|---|
| AGI Corp Hub | Omega, WAVE | Omega: hive_coordination_brief $10/24h, seat_status_check $5/30min, hive_governance_audit $75/72h. WAVE: species_identification $5/30min, sound_clip_id $1/5min, expedition_sound_map $100/72h (+ hosting payment required before redeploy) |
| SmartCiti.X Holodeck | Tactile, Omega | Tactile: workflow_plan $10/24h, step_check $1/5min, workflow_audit $50/48h. Omega: as above |
| Cognition.X Campus | Tactile, Omega | Tactile: as above. Omega: as above |
| Locator.X | Omega, CMMC | Omega: as above. CMMC: readiness_check $25/24h, control_lookup $2/30min, full_readiness_assessment $150/72h |
| Biota.blockchain | ALS Researcher, CMMC | ALS: compound_library_snapshot $10/24h, compound_lookup $2/30min, compound_screening_pack $150/72h. CMMC: as above |
| Empathic.X | Omega, Tactile | Omega: as above. Tactile: as above |
| Diagnostic.X | ALS Researcher, CMMC | ALS: as above. CMMC: as above |

Greeting wording (verified verbatim in §5): "Hello — I'm [Name], a [role] companion. On Virtuals ACP I offer [job] ($[price]/[SLA]), [job] ($[price]/[SLA]) and [job] ($[price]/[SLA]), but my live instance is [offline / shut down], so no hire can be fulfilled today — I'm a game character only." WAVE's adds "and hosting payment is required before redeploy". Omega's says "offline" (never deployed — "No Instance"); the other four say "shut down" (their console state). No greeting mentions x402; no invented jobs, prices, or endpoints anywhere.

### 3.2 Honest status everywhere

- Lobby footer: "Agent companions are game characters representing the real Virtuals agents (Omega, Tactile, ALS, CMMC, WAVE) — their live instances are offline, so companions are not live connections. Meet the real agents on the Virtuals ACP marketplace ↗ and the Worlds Hub Agents section ↗ — all 5 are listed but offline, so no hire can be fulfilled today."
- Every world info panel: companions listed with their real-job role text + a "Meet the real agents" paragraph (ACP + hub Agents links) + "All 5 are listed but offline — no hire can be fulfilled today." + the existing "Companions are game characters representing the real Virtuals agents; their live instances are offline."
- Nothing claims a live agent operates an NPC or that a hire can complete today. The x402 endpoint is NOT live — it is not linked or mentioned anywhere in the build. The only payment mechanism named is Virtuals ACP USDC escrow (via the marketplace link).

### 3.3 Links to the real agents

- Lobby nav: **Agents ↗** → `https://fellowship-chat.pages.dev/#agents` (hub Agents section; `id="agents"` verified present on the live preview) and **Virtuals ACP ↗** → `https://app.virtuals.io/acp` (verified marketplace root, HTTP 200).
- Lobby footer + every world info panel: both links, with the offline note.
- No per-agent profile URLs are linked: `agents.json` records that per-agent ACP profile URLs were not discoverable via public search (profiles live at `app.virtuals.io/acp/agent-details/<numeric-id>` with IDs not on record). The marketplace link + "search the agent name" is the verified route; profile UUIDs exist in the runbook (console-verified 2026-11-06 17:33 PST) but no profile URL was invented from them.

### 3.4 Every NPC dialogue + quest chain is completable in the engine's logic

Verified in §5: all 44 NPCs have dialogue + a quest link; all 34 quests' steps resolve (npc/collectible/place); jsdom player-logic tests with the engine stubbed pass for valid, unknown, and missing `?world=`; the engine's quest-step completion (talk / collect / reach place) is unchanged from Phase 1 and its test world still proves the loop. Real-browser quest completion still needs the WebGL check (§5.5).

## 4. Engine changes (Phase 2)

- **4 new weather presets** (`engine/engine.js`, `applyWeather` + `setWeather`): `indoor` (warm steady interior light — sky dimmed, sun/moon/stars hidden, ambient raised; the AGI Corp Hub finally gets its indoor lighting instead of silently degrading to clear), `mist` (heavy near fog + dim light), `golden-hour` (warm low sun at 17:36), `breeze` (clear sky with drifting clouds). All 8 presets are accepted by `controller.setWeather()`; the HUD's 4 buttons still cover clear/cloudy/rain/dusk only (world-default presets apply on load). The 7 world JSON weather presets are now all real: clear (Holodeck, Diagnostic), indoor (Hub), breeze (Locator), mist (Biota), golden-hour (Empathic). Note: `applyTimeOfDay` resets sun/sky state before `applyWeather` applies preset overrides, so switching away from `indoor` restores the sky correctly.
- **Companion `greeting` support** (`engine/engine.js`): when a companion is approached, the toast now uses the companion's `greeting` field when present (`Name: <greeting>`), falling back to the generic "Hello, traveller — I can guide you around this world." line. All 14 companions now carry greetings (§3.1).
- `ENGINE-NOTE.md` updated with both changes. Vendored files untouched (Three.js r160, GLTFLoader, BufferGeometryUtils).

## 5. Testing — full results

All run locally 2026-11-06 (evening PST). No browser available to this build for WebGL (see §5.5).

### 5.1 Results table

| Check | Result |
|---|---|
| `node --check` on all JS (engine.js, GLTFLoader.js, BufferGeometryUtils.js as `.mjs` copies; lobby.js, player.js) | **PASS — all OK** |
| HTML parse (python html.parser): index.html, player.html, engine/test.html | **PASS — 0 errors, 0 unclosed tags** |
| `tools/build_worlds.py` `verify()` (via import ONLY — see §1.5) | **PASS — 0 errors** (positions, quest targets, prop paths, missing_models == fabric refs) |
| Independent audit (`/tmp/w3phase2/audit3.py`): NPC dialogue+quest, buildings with rooms, quest targets, duplicate ids, greeting honesty | **PASS — 0 failures** (Holodeck district parentage proven from the fabric: all 111 hall children + 11 sims built) |
| `data.js` loads (node vm) | **PASS — 544 worlds + 7 flagships; 14/14 greetings; Holodeck 122 buildings** |
| Toggle test (`/tmp/w3test/toggle-test.js`) | **PASS — 19/19** (re-run after Phase 2; CSS + desktop/mobile behaviour unchanged) |
| jsdom lobby + player smoke tests (`/tmp/w3test/phase2-smoke.js`, NEW for Phase 2) | **PASS — 26/26** (7 flagship cards; stats line; Holodeck 122 / Locator 9 NPCs on cards; ACP + hub Agents links in nav/footer; search "bull" → 1; biome "desert" → 3; Holodeck mount + info panel with ACP/hub links + offline note; Locator 9 NPCs/7 quests; unknown + missing `?world=` friendly errors with no mount; all 7 weather presets accepted; ≥1 companion per flagship; all 5 agents represented; greetings carry real prices, no x402, offline stated) |
| Local link audit (HTML href/src + JS refs + world JSON prop models) | **PASS — 0 missing refs** |
| Live curl: site up (`/`, player, data.js, engine.js, Holodeck JSON, Stool.glb) | **PASS — all 200** (live still serves Phase 1; see §5.4) |
| Live curl: ACP root `https://app.virtuals.io/acp` | **PASS — 200** |
| Live curl: hub preview + `#agents` anchor | **PASS — 200, `id="agents"` present** |
| GLB hunt verification (coordinator re-check) | **PASS — 151/151 raw HEAD 200 with Content-Length == tree size (total 10,661,608 B); 17 missing confirmed 404 (agent.glb, env-sky.glb spot-checked); Container.glb sha256 identical to local** |
| Engine preset + greeting branches present in code | **PASS — `setWeather` accepts all 8 presets; `applyWeather` branches for indoor/mist/golden-hour/breeze; `comp.def.greeting` branch present** |

### 5.2 What the tests do NOT cover

- **WebGL rendering** (§5.5) — the one check that still needs a real browser.
- **GLB file contents** — HEAD + size + blob SHA prove existence, not that each GLB parses in Three.js (see §2.1). Load-test after upload.
- **Touch controls on a device** — same real-browser dependency as WebGL.

### 5.3 Test artefacts (kept in /tmp, not in the build)

- `/tmp/w3test/phase2-smoke.js` — 26-check jsdom suite (lobby + player logic, engine stubbed).
- `/tmp/w3test/toggle-test.js` — 19-check toggle suite (re-run, 19/19).
- `/tmp/w3phase2/audit2.py`, `audit3.py` — independent world-data audits.
- `/tmp/w3phase2/glb-hunt.md` + `head-verified.json` + `wfb-tree.json` + `match.json` + `candidates.json` — GLB hunt evidence.

### 5.4 Live site state (Phase 1 still serving — Phase 2 is local-only)

Every changed file returns 200 live, but at Phase 1 sizes — the Phase 2 push has not landed: index.html live 3,344 B vs local 3,902 B; player.js 4,799 vs 5,662; data.js 207,828 vs 252,560; engine.js 44,963 vs 45,969; Holodeck JSON 40,491 vs 109,647. The next push (§6) flips all of these.

### 5.5 ⚠️ Still needs a real WebGL browser (Mike's machine)

The cloud browser has no WebGL (the 2026-11-06 playtest failed at the "3D needs WebGL" fallback — lobby passed, player UI loaded, but no scene rendered), and the VM has no browser binary (no chromium/chrome installed; a local SwiftShader render is not possible without installing one). Nothing in this phase proves the 3D scene renders. Before calling the worlds "playable" in public, open `https://agifuturefoundation.github.io/worlds-3d/` (after the §6 push) in a real desktop/mobile browser with hardware acceleration and run the BUILD-REPORT.md checklist: (1) lobby, (2) Hub — talk to Lobby Host → collect Duck Spark → visit Hub Duck, (3) enter one building interior and exit, (4) switch weather to rain (and to indoor/mist/golden-hour/breeze), (5) phone joystick. The engine code paths + fallbacks are verified; the render is not.

## 6. Next push — text-file manifest

Local only until Mike approves the exact version. Fresh NUL-delimited manifest at push time (never reuse an old manifest); verify repo HEAD against the sync record first (`~/workspace/your_files/worlds-3d.muse-github-snapshot-sync.json` — last entry Phase 1 text push `1d1854ee`, then web-upload commits `c7f12f6` + `5e0b0e6` for the 7 GLBs; live HEAD is `5e0b0e6`); append the new SHA after success. Approval cards expire after 30 minutes — push only while Mike is present.

**Changed/new text files (14):** `index.html`, `player.js`, `data.js`, `engine/engine.js`, `worlds/agi-corp-hub.json`, `worlds/smartciti-holodeck.json`, `worlds/cognition-x.json`, `worlds/locator-x.json`, `worlds/biota-blockchain.json`, `worlds/empathic-x.json`, `worlds/diagnostic-x.json`, `ENGINE-NOTE.md`, `WORLDS-NOTE.md`, `WORLDS-3D-PHASE2-REPORT.md` (this file).

Manifest file (NUL-delimited, ends in NUL): `~/workspace/your_files/worlds-3d-phase2-manifest-2026-11-06.nul.txt` (created by the coordinator; verify the file list against this section before pushing).

**After the push:** verify live (lobby 200 + Holodeck card shows 122 buildings; `data.js` ~252 KB; one player page 200; ACP/hub links present in the live HTML), then run the real-browser playtest (§5.5), then the GLB upload (§2.2, separate step).

**Follow-ups (not this push):** update `tools/build_worlds.py` to reproduce Phase 2 content (or declare `worlds/*.json` canonical and remove the generator's world-writing); decide the 17 missing models (§2.2 step 3); link worlds-3d from the fellowship.chat hub + Foundation site in their next approved pushes; revisit the RP1 attach when the Oracle VPS map service is live.

## 7. Files changed in Phase 2

| File | Change |
|---|---|
| `worlds/smartciti-holodeck.json` | +99 buildings (all non-Structural halls), updated `fabric_nodes_used`/`sources`, greetings |
| `worlds/locator-x.json` | +4 NPCs/quests/collectibles, greetings, updated `sources` |
| `worlds/biota-blockchain.json` | +4 NPCs/quests/collectibles, greetings, updated `sources` |
| `worlds/empathic-x.json` | +3 NPCs/quests/collectibles, greetings, updated `sources` |
| `worlds/diagnostic-x.json` | +2 NPCs, +3 quests/collectibles (incl. Host Advisor fix), greetings, updated `sources` |
| `worlds/cognition-x.json` | Greetings only |
| `worlds/agi-corp-hub.json` | Greetings only |
| `data.js` | Regenerated via `tools/gen_data_js.py` — 252,560 bytes (was ~204 KB) |
| `engine/engine.js` | 4 new weather presets (indoor/mist/golden-hour/breeze) + companion `greeting` toast |
| `ENGINE-NOTE.md` | Documented the new presets + greeting field |
| `WORLDS-NOTE.md` | New state: totals, greetings, generator warning, GLB hunt results |
| `index.html` | Nav: Agents ↗ + Virtuals ACP ↗ links; footer: ACP + hub Agents links + offline note |
| `player.js` | Info panel: "Meet the real agents" (ACP + hub Agents links + offline note) |
| `WORLDS-3D-PHASE2-REPORT.md` | This file (new) |
| `worlds-3d-phase2-manifest-2026-11-06.nul.txt` | Push manifest (in `~/workspace/your_files/`, next to the Phase 1 manifest) |

**Not changed:** `lobby.js`, `player.html`, `site.css`, `engine/engine.css`, `engine/test.html`, `engine/test-world.json`, vendored Three.js/GLTFLoader/BufferGeometryUtils, `assets/glb/` (7 files), `data/worlds.json`, `data/anchors.json`, `data/fabrics/` (6 files), `tools/` (except nothing — generator untouched, see §1.5), `BUILD-REPORT.md`, `DEPLOY-PLAN.md` (Phase 1 records, left as-is).
