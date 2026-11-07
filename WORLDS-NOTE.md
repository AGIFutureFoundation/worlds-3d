# Worlds-3D — Data Layer Note (Worker 2)

Build folder: `~/workspace/your_files/worlds-3d/`
Built 2026-11-06 by a reproducible script: `tools/build_worlds.py` (re-run it to regenerate
everything from the ground-truth files; it also runs the verification pass).
Local files only. No push, no deploy, no browser work.

## Per-world grounding table

| World file | Fabric file (local copy in `data/fabrics/`) | Fabric nodes | Nodes used in this build | Models missing | NPCs | Quests | Collectibles | Companions |
|---|---|---|---|---|---|---|---|---|
| `worlds/smartciti-holodeck.json` | `holodeck.json` (S10, anchored) | 131 total (scene + 19 top-level + 111 nested); 131 refs, 124 distinct | 8 District nodes → districts; **111 halls + 11 Sim nodes → 122 buildings (Phase 2: all halls built)** | 124 | 4 | 3 | 8 | Tactile, Omega (greetings, Phase 2) |
| `worlds/cognition-x.json` | `cognition.json` (S1, anchored) | 26 total; 26 refs, 26 distinct | All 25 pack nodes → buildings; 5 of them also district anchors | 26 | 4 | 3 | 8 | Tactile, Omega (greetings, Phase 2) |
| `worlds/locator-x.json` | `worlds/locator-x/world.json` (S8, anchored) | 38 total nodes; 31 refs, 12 distinct | 7 Zone nodes → districts + buildings; Gate + Sign → buildings | 12 | **9** | **7** | **11** | Omega, CMMC (greetings, Phase 2) |
| `worlds/biota-blockchain.json` | `worlds/biota-blockchain/world.json` (BioDAO, anchored) | 36 total nodes; 30 refs, 12 distinct | 6 Zone nodes → districts + buildings; Gate + Sign → buildings | 12 | **9** | **7** | **12** | ALS Researcher, CMMC (greetings, Phase 2) |
| `worlds/empathic-x.json` | `worlds/empathic-x/world.json` (S2, anchored) | 34 total nodes; 28 refs, 12 distinct | 6 Zone nodes → districts + buildings; Gate + Sign → buildings | 12 | **8** | **6** | **10** | Omega, Tactile (greetings, Phase 2) |
| `worlds/diagnostic-x.json` | `worlds/diagnostic-x/world.json` (S3, anchored) | 30 total nodes; 25 refs, 12 distinct | 5 Zone nodes → districts + buildings; Gate + Sign → buildings | 12 | **7** | **6** | **10** | ALS Researcher, CMMC (greetings, Phase 2) |
| `worlds/agi-corp-hub.json` | `rp1-review/scenes/agi-corp-hub.json` (demo, no fabric) | 9 total; 7 refs, 7 distinct — ALL local | All 7 model nodes → buildings, each with its real local GLB as an interior prop | 0 | 3 | 2 | 6 | Omega, WAVE (greetings, Phase 2) |

Totals (Phase 2, 2026-11-06): 38 districts, **186 buildings** (was 87), **44 NPCs** (was 31), **34 quests** (was 20), **65 collectibles** (was 51), 198
`missing_models` entries across the 7 files = **168 distinct GLB refs** — exactly the
hub's verified count of 168 unique model paths referenced by the six anchored fabrics.
Phase 2 detail: `WORLDS-3D-PHASE2-REPORT.md`. **GLB hunt (Phase 2): 151/168 refs FOUND** in
public repo AGIFutureFoundation/WorldForge-Browser (raw HEAD 200, total 10,661,608 bytes);
**17 NOT FOUND anywhere reachable** (the 4 zone worlds' shared `../models/` set + per-world
sign/world models); `Container.glb` hash-proven identical to the local copy, so the upload
is 150 new files (10,007,608 bytes). Full manifest in the Phase 2 report §2.

### Counting note (why two numbers per fabric)
The task brief's counts (131 / 26 / 31 / 30 / 28 / 25) are **total `sReference`
counts** (including duplicates and nested nodes). The "fabric nodes" column above is
the **walk count** (scene root + every `aChildren` node, including `Light · ...`
nodes with no model ref and `Swarm · ...` children). Both were verified on disk:
Holodeck 131 nodes / 131 refs; Cognition 26 / 26; Locator 38 nodes / 31 refs;
Biota 36 / 30; Empathic 34 / 28; Diagnostic 30 / 25; Hub 9 / 7.

## Fabric transform per world

Recorded in each JSON as `fabric_transform` (`scale`, `offset`, `mapping`).

- **All 6 anchored fabrics:** fabric positions are plan coords `[x, y, 0]`.
  Engine mapping: `engine_x = fabric_x * scale`, `engine_y = fabric_z * scale`
  (0 for plan nodes), `engine_z = fabric_y * scale`, offset `[0, 0, 0]`.
  Scales: Holodeck **0.15** (fabric extent ±408 → play area ±61, terrain 160);
  Cognition **0.25** (extent ±160 → ±40, terrain 120);
  Locator / Biota / Empathic / Diagnostic **1.5** (extent ±31 → ±46, terrain 120).
- **AGI Corp Hub only:** hub fabric positions are `[x, y, z]` with **z = height**.
  Engine mapping: `engine_x = fabric_x * 6`, `engine_y = fabric_z * 6`,
  `engine_z = fabric_y * 6`, offset `[0, 0, 0]` (terrain 60).
- **Agent NPC positions (zone worlds):** `Agent · ...` nodes are nested children of
  their Zone node with a local offset (usually `[0, 0, 0.3]`); the NPC position is
  the zone position + the agent node's local offset, transformed. Biota's agents
  are spread across zones (R&D under Therapy Lab; Compliance + Finance +
  Communication under Governance Hall; Security under Ledger; Health under Data
  Exchange) — not under the Agents Hub zone.
- **Steward seats:** each zone fabric also has `Steward seat 1–3 · human` children
  under its Steward Council zone. They are real fabric nodes but were NOT built as
  NPCs (they represent human seats, not game characters).

## What was verified

- `python3 tools/build_worlds.py` re-ran clean; its built-in verification passed.
- Independent re-check: `json.load` on **every** JSON in the build (7 worlds +
  `data/anchors.json`, `data/worlds.json`, 6 fabric copies) — all parse.
- Every position/size is a 3-number array (spawn, districts, buildings, rooms,
  NPCs, collectibles, interior props).
- Every quest step target resolves: `npc` → existing NPC id, `collectible` →
  existing collectible id, `place` → an existing district/building name.
- Every interior prop model path exists under `assets/glb/` (only the Hub has
  props; the other six worlds' rooms have empty `props` arrays — their models are
  unhosted, so no fake prop paths were invented).
- Every `missing_models` entry matches a real fabric `sReference`, and each
  world's set equals that fabric's full distinct-ref set.
- `data/worlds.json` is byte-identical to
  `worlds-hub-fellowship-chat/worlds.json` (544 `worldforge_worlds` entries +
  collections summary). All 6 `data/fabrics/*.json` copies are byte-identical to
  their sources.
- All 7 GLBs byte-identical to sources (sha256 matched). See table below.
- Schema keys on all 7 world JSONs are exactly the specified set
  (`id, name, series, status, rp1, coordinates, fabric_url, biome, spawn,
  terrain, weather, fabric_transform, fabric_nodes_total, fabric_nodes_used,
  districts, buildings, npcs, quests, collectibles, agent_companions,
  missing_models, sources`).

## Local GLB assets (`assets/glb/`)

| File | Bytes | sha256 |
|---|---|---|
| Stool.glb | 1,420,688 | `a749341e4069d13093742639526eb2897d00f0d3a915b32b84dbd7f0e60ab7fb` |
| Bucket.glb | 514,972 | `d04ef8fe6cafeb29fde0ecec76bab23a950147e1efb13528076f87174e2fe95c` |
| Crate.glb | 1,189,256 | `3014a3d345149225729c4f2d6b4561d2640c9f2cd2fb4c163b73fb1b5f2a9dda` |
| Tin.glb | 514,492 | `cfbabe76cfc4b9f6e543e3da3dc6c3107104cce62b49f512974c0abeaa2c5c00` |
| Container.glb | 654,000 | `0ab03bb08024dcf7f09f9b1d61e9948cb10e1614fd8b62171b4515392efc60a4` |
| duck.glb | 120,484 | `65bf938f54d6073e619e76e007820bbf980cdc3dc0daec0d94830ffc4ae54ab5` |
| capsule.glb | 3,536,012 | `30d71312bfcd0597eb0b1437c1859146980a2e9405b622b99c9f93dfe77edc27` |

Sources: `rp1-review/poc-world/stool-src/assets/` (Stool, Bucket, Crate, Tin,
Container) and `rp1-review/msf-map-svc/sample/objects/` (duck, capsule).
Only the Hub world references these; all other worlds' interiors have no props.

## Shared data (`data/`)

- `data/worlds.json` — verbatim copy of the 544-world hub list
  (`worldforge_worlds` + collections summary). All entries rp1:null.
- `data/anchors.json` — the 6 anchors: id, name, series, lat, lon, fabric_url,
  status `"anchored"`, rp1 null. "Anchored" = a real-world anchor coordinate
  exists; none of the six is live on RP1.
- `data/fabrics/` — verbatim copies of the 6 fabric JSONs for reference
  (`holodeck.json`, `cognition.json`, `locator.json`, `biota.json`,
  `empathic.json`, `diagnostic.json`).

## Grounding choices the lobby/integration worker should know

- **Biomes are design choices**, labelled as such in each JSON's `sources`:
  Holodeck city, Cognition campus, Locator coastal, Biota forest, Empathic grove,
  Diagnostic campus, Hub hub.
- **NPCs:** Locator / Biota / Empathic / Diagnostic NPCs come from the real
  `Agent · ...` fabric nodes (name + role from the node name). Holodeck and
  Cognition have **no** `Agent · ...` nodes in their fabrics, so their NPC roles
  are named after real fabric hall/pack nodes instead. The Hub likewise has no
  agent nodes; its NPCs are named after real Hub nodes. **All NPC dialogue is
  original game dialogue** — never attributed to a real person, and no NPC claims
  to be a real person.
- **Agent companions** use only the 5 real Virtuals agents and their real ACP
  jobs from `agents.json` (Omega `hive_coordination_brief`, Tactile
  `workflow_plan`, ALS Researcher `compound_library_snapshot`, CMMC
  `readiness_check`, WAVE `species_identification`). Each companion entry states
  it is a **game character only — the live instances are offline** (verified
  2026-11-06: listed on ACP, no instance deployed), not a live connection.
  **Phase 2:** every companion now also has a `greeting` (2 sentences, real
  job + price + offline/shut-down wording, no x402 mention) spoken by the engine
  on approach; the lobby nav/footer and every world info panel link to the live
  Virtuals ACP marketplace (`https://app.virtuals.io/acp`) and the Worlds Hub
  Agents section (`https://fellowship-chat.pages.dev/#agents`) with the offline
  note. No per-agent profile URLs are linked (none discoverable via public
  search — see `agents.json` `profile_url_note`).
- **Holodeck is now complete (Phase 2):** 131 fabric nodes → 8 districts +
  **122 buildings** (111 halls + 11 sims). **Caveat:** hall positions are each
  fabric node's own position, so halls from different districts share the same
  central plan grid and overlap in-world — the fabric gives no per-district
  offset; labelled in the world's `sources`. A district-offset layout would be
  a deliberate redesign, not a fill.
- **Cognition districts** are 5 real pack nodes used as district anchors
  (design choice); all 25 packs are buildings.
- **Phase 2 NPC additions:** Locator's `Agent · Developer Brief Desk`,
  Biota's `Agent · Communication Agent`, and the `Advisor · Steward Liaison` /
  `Advisor · Alignment Advisor` nodes are now NPCs (with dialogue + quests) in
  their worlds; Diagnostic's Host Advisor got its missing quest link. Steward
  seats 1–3 remain human-only, never NPCs. Swarm children, Light/Sky/Terrain
  nodes remain unbuilt as places/NPCs (duplicates/lighting, not characters).
- **Hub `fabric_url` is null** (no fabric — built from the Hub scene JSON) and
  its `coordinates` are null; its scene file states "demo scene — NOT live on
  RP1", anchored false. Its `model_status` on the Lobby district notes the
  district itself is a design choice.
- **Diagnostic NPC framing:** the Medical AI Avatar's dialogue states it is a
  demo guide, not a doctor, and nothing in the world diagnoses — screening /
  teaching examples only.

## Open gaps (updated Phase 2, 2026-11-06)

1. **168 fabric GLBs: 151 found, 17 still unhosted.** The 151 live in public
   repo AGIFutureFoundation/WorldForge-Browser (raw HEAD 200, 10,661,608 bytes
   total); the upload is 150 new files (10,007,608 bytes) because `Container.glb`
   is hash-proven identical to the local copy. The 17 missing (the 4 zone
   worlds' shared `../models/` set + per-world sign/world models) exist nowhere
   reachable — see `WORLDS-3D-PHASE2-REPORT.md` §2 for the full manifest +
   upload plan. Until the upload lands, every one stays listed in
   `missing_models` with status `"not hosted — procedural placeholder shown"`.
   After upload, rewire `missing_models`/district `model_status` to hosted +
   regenerate `data.js`, and load-test one file per group in a real browser.
2. **No RP1 attachment anywhere:** all 7 worlds have `rp1: null`; the 6
   anchored worlds are anchored by coordinate only.
3. **Holodeck depth: CLOSED in Phase 2** (all 111 halls + 11 sims built).
   Remaining layout note: halls overlap on the shared plan grid (§1.4 above).
4. **No live agent connections:** companions are characters, not live hires.
   Hiring/fulfilment needs the agents' instances deployed (separate workstream).
5. **Biota has no W3 series number** in the April 2026 internal series list —
   anchored by fabric only, not by a series slot.
6. **Engine files present in this folder** (`engine/`, `utils/`, `engine/test-world.json`)
   belong to the engine worker, not this data build — untouched here.
7. **⚠️ `tools/build_worlds.py` is out of sync with `worlds/*.json`.** Its
   `main()` regenerates all 7 world JSONs from Phase 1 code and would wipe the
   Phase 2 fill (99 Holodeck halls, 13 new NPCs/quests, companion greetings).
   Do NOT run it as a script. `verify()` by import is safe (0 errors, Phase 2).
   Either update the generator to reproduce Phase 2, or treat `worlds/*.json`
   as canonical. `tools/gen_data_js.py` (data.js only) remains safe.
8. **Weather presets are now real in the engine (Phase 2):** `indoor`, `mist`,
   `golden-hour`, `breeze` join clear/cloudy/rain/dusk in `applyWeather` +
   `setWeather`. All 7 world presets are engine presets now.
9. **WebGL render still unverified** (cloud browser has none, VM has no browser
   binary) — needs a real browser with hardware acceleration; see the Phase 2
   report §5.5 for the playtest checklist.
