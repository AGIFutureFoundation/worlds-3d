# worlds-3d Engine — Note

Build folder: `~/workspace/your_files/worlds-3d/`
Engine: plain Three.js r160, ES modules, no backend, no runtime CDN. All files local; works from `file://` and GitHub Pages with relative paths only.

## Files

| File | Size | What it is |
|---|---|---|
| `engine/three.module.min.js` | 655 KB | Vendored Three.js r160 (three@0.160.0, downloaded once from unpkg at build time) |
| `engine/GLTFLoader.js` | 106 KB | Vendored GLTFLoader r160, unmodified |
| `utils/BufferGeometryUtils.js` | 31 KB | Vendored r160 helper — **required**: stock GLTFLoader imports `../utils/BufferGeometryUtils.js` relative to `engine/`, so it must live at build-root `utils/`, not under `engine/`. Only deviation from the contract layout, and the reason is upstream's own relative import (editing the vendored loader was avoided so it stays byte-identical to upstream). |
| `engine/engine.js` | 51 KB | The engine (see API below) |
| `engine/engine.css` | 5.7 KB | HUD + touch controls, responsive |
| `engine/test-world.json` | 1.9 KB | Test fixture in the contract schema shape (1 placeholder district, 1 hosted district, 1 hosted building, 1 interior room with 2 GLB props, NPC quest `q1` with npc + collectible steps) |
| `engine/test.html` | 1.5 KB | Test page: importmap + `mountWorld` + console self-checks |

## API

```js
import { mountWorld } from './engine.js'; // from a page inside engine/
const controller = mountWorld(containerElement, worldDef, options);
// controller = { stop(), setWeather(preset), setTimeOfDay(hour), teleport([x,y,z]), state }
```

- `worldDef` — the WORLD JSON SCHEMA shape: `id, name, series, status, rp1, coordinates, fabric_url, biome, spawn, terrain{size,height,seed,water}, weather{preset,dayCycle}, districts[], buildings[]{interior{rooms[]{props[]}}}, npcs[], quests[], collectibles[], agent_companions[], missing_models[], sources[]`.
- `options` — `{ startHour = 10, weather = null (else worldDef.weather.preset), dayCycle = true }`.
- `state` — `{ world, webgl, running, hour, weather, dayCycle, collected[], questsAccepted{}, questProgress{}, questsComplete{}, position, nearNPC, nearBuilding, insideBuilding, companionGreeted }`.
- Player pages in other folders: copy the importmap from `test.html` and point `"three"` at the relative path to `engine/three.module.min.js` (e.g. `"../engine/three.module.min.js"` from a sibling folder). `engine.js` imports `./GLTFLoader.js`, which resolves its own `../utils/` dependency — keep `engine/` and `utils/` side by side at the build root.
- `state.webgl === false` + the in-page fallback message means WebGL was unavailable; the controller returned in that case is a safe no-op (all methods callable, `stop()` removes the HUD).

## Systems implemented (all in `engine.js`)

1. Renderer + graceful degradation: `try/catch` around `WebGLRenderer`; on failure shows "3D needs WebGL — your browser/device does not provide it" and returns a no-op controller. Pixel ratio capped at 2; resize handler.
2. Skybox: procedural gradient sky dome (shader), sun + moon discs, 700 stars; driven by `hour` (0–24). Day-cycle advances ~0.15 h/s when enabled; the HUD slider overrides it.
3. Weather presets `clear / cloudy / rain / dusk` **plus Phase 2 presets `indoor / mist / golden-hour / breeze`**: rain = 1,400-point particle system falling around the avatar + dimmed light + fog; clouds = 10 drifting billboard clusters of flattened spheres; fog per preset. Dusk jumps the clock to 18:24. `indoor` = warm steady interior light (sky dimmed, sun/moon/stars hidden, ambient raised — for the AGI Corp Hub demo lobby); `mist` = heavy near fog + dim light; `golden-hour` = warm low sun at 17:36; `breeze` = clear sky with drifting clouds. All eight presets are accepted by `controller.setWeather()`; the HUD's four buttons still cover clear/cloudy/rain/dusk only (world-default presets apply on load).
4. Terrain: 110×110-segment heightfield from `terrain{size,height,seed}` with seeded value noise; the same analytic `heightAt(x,z)` drives the mesh and the avatar (no sampling mismatch). Borders flatten.
5. Water: animated plane when `terrain.water` is true — procedural canvas texture, scrolling UV offset + pulsing opacity, no external textures.
6. Foliage: instanced trunks / cone canopies / sphere canopies / grass tufts; density + palette from `biome` (`city, forest, desert, coastal, snow`).
7. Buildings: procedural boxes with a canvas-drawn window texture (no external images), cone roof, door mesh + door trigger. Interiors: walking to a door and pressing E / Interact teleports into an interior room built at y = −120 (room box + floor + ceiling light + props); props load via GLTFLoader from local `assets/glb/` paths with a procedural crate fallback if the GLB is missing/fails. Blue EXIT pad + Interact returns outside. Interior labels say "game space". **Hosted building models** (`model_ref` + `model_status: "hosted"` on a building): loaded LAZILY — only once the avatar comes within 120 units (scan throttled to once per 0.5 s in the main loop) — through the shared load queue; on success the procedural body/roof/door hide and the fitted GLB takes their place (name label stays, collision keeps the procedural AABB). No current world ships a building `model_ref` (186 buildings, all procedural), so this path is ready but unexercised against real data; it is covered by the jsdom smoke test (`/tmp/w3d-smoke/test.mjs`, ephemeral) with a synthetic hosted building.
8. Districts: coloured ground plates + floating name sprites. **Hosted districts** (`model_ref` + `model_status: "hosted"`, 13 of 38 across the 7 flagships) load their GLB EAGERLY at mount through the shared queue; the model is fitted to the plate (see §13) and REPLACES the procedural arch/plinth in-scene. **Placeholder districts** (24 of 38, all `../models/zone-marker.glb`) keep the procedural arch/plinth and get an in-world "model not hosted — placeholder" plaque plus the same wording in the HUD info panel. A district with no `model_ref` at all (the Hub lobby) is neither: its info-panel row shows its `model_status` text ("design choice — …") and no plaque. The plaque rule is `isPlaceholderModel()` — hosted iff status is exactly `"hosted"` — which matches the data's real placeholder string `"not hosted — procedural placeholder shown"` and the legacy fixture spelling `'not-hosted'` alike (see §13). Placeholders are never presented as the real model. If a hosted GLB fails to load, the procedural form stays, the failure is `console.warn`ed, and it is counted in `state.modelLoads.failed` — never a blank hole.
9. Avatar: third-person capsule + name label, orbit camera; WASD/arrows, Space jump, Shift run; collision = terrain height + push-out from building AABBs (clamped to room bounds indoors). Touch: left virtual joystick, right-side drag to look, on-screen Jump + Interact buttons (shown on coarse pointers). Agent companions follow at an offset and show a greeting toast when approached — the toast uses the companion's `greeting` field when present (Phase 2: each companion's greeting reflects its real ACP job + price and states its live instance is offline), otherwise the generic guide line.
10. NPCs: capsule figures + name/role labels; E / Interact opens a dialogue panel cycling that NPC's lines; "Accept quest" button when the NPC has a quest.
11. Quests + collectibles: HUD quest tracker (title, current step, n/N progress); steps complete by talking to an NPC, collecting a collectible, or reaching a target position. Collectibles are rotating floating meshes — spark = gold octahedron, relic = purple icosahedron, data = cyan box — with a ground halo; walking into one collects it (HUD counter + toast). Completing the last step shows a "Quest complete" toast with the reward text.
12. HUD: top bar (world name + status badge + "Web 3D interpretation — not on RP1"), quest tracker, collectible counter, compass strip (N/NE/E/… from camera yaw), weather buttons + time-of-day slider, info panel (districts + missing-model notes + sources). Responsive CSS + viewport meta; info panel hides on coarse-pointer/small screens.

Performance: instanced foliage, static-draw usage, reused `Vector3/Matrix4/Quaternion` temporaries in the hot loop (no per-frame allocations there except unavoidable small ones in toast/quest rendering, which are event-driven, not per-frame).

## Controls

- Keyboard: WASD / arrow keys move (camera-relative), Space jump, Shift run, E interact / talk / enter building.
- Touch: left joystick move, drag right half of screen to look, Jump + Interact buttons.
- HUD: weather preset buttons, time-of-day slider (0–24 h).

## 13. Hosted GLB loading strategy (added 2026-11-06)

Why this shape: a world carries at most ~8 districts (landmarks, few) but up to dozens of buildings, most never approached; GLBs are fetched + parsed at runtime, so eager-loading everything would stall the first frame and saturate the network on Pages.

- **Queue:** one shared queue, max 2 concurrent `GLTFLoader.load` calls (`MAX_CONCURRENT_LOADS`). Interior props still load directly (pre-existing behaviour, not queued).
- **Districts — eager:** every hosted district enqueues at mount. On success the procedural arch/plinth group is removed from the scene and the GLB is added; on failure the procedural form stays and the error is logged + counted.
- **Buildings — lazy:** a hosted building enqueues only when the avatar comes within 120 units (`LAZY_LOAD_RADIUS`); the distance scan runs at most once per 0.5 s (`lazyTimer` in the main loop) so it costs nothing per frame. On success only the procedural body/roof/door meshes hide (label + door trigger + collision AABB stay); on failure the procedural building stays.
- **Fitting:** `placeModelInHolder()` normalises unknown GLB scales — widest horizontal extent scaled to the target width (district plate ≈ 18 units; building = max footprint side), centred horizontally on the holder, base resting on terrain height; all meshes get `castShadow`/`receiveShadow`.
- **Status rules (Task 2 fix, engine side — no data changed):** `isHostedModel()` = `model_ref` present AND `model_status === 'hosted'`; `isPlaceholderModel()` = `model_ref` present AND status is anything else. The engine previously checked `model_status === 'not-hosted'`, but the data writes `"not hosted — procedural placeholder shown"` (see `tools/rewire_models.py` `PLACEHOLDER_STATUS`), so the plaque never fired. Changing the data side was rejected: the descriptive string is used by 24 district refs + 17 `missing_models` entries across 6 world JSONs, and the engine-side rule also covers the legacy `'not-hosted'` spelling in the test fixture. `worlds/*.json` and `data.js` were NOT touched by this change.
- **Observability:** `state.modelLoads = { requested, loaded, failed }` counts queue jobs (districts + buildings; interior props are not counted).
- **Local caveat:** this working copy holds only the 7 Phase 1 GLBs in `assets/glb/`; the 150 staged GLBs live in the remote repo, so no real staged GLB was loaded locally. The loader path is URL-based and identical for both, and the jsdom smoke test stubs `GLTFLoader.load` to prove the wiring.

## What was verified (2026-11-06, node/jsdom only — no browser available to this worker)

- `node --check` (as `.mjs` copies): `engine.js` OK, `GLTFLoader.js` OK, `BufferGeometryUtils.js` OK, `test.html` inline module script OK.
- Real module import in Node (temp dir mirroring the real layout + a `node_modules/three` shim for the bare specifier): `import('./engine/engine.js')` loads, exports `mountWorld` as a function — the full import graph resolves, including GLTFLoader → `../utils/BufferGeometryUtils.js`.
- `test-world.json` parses; all contract keys present; 1 placeholder district (production status string), 1 hosted district, 1 hosted building, 1 interior room with 2 GLB props, NPC quest `q1` with npc + collectible steps.
- Importmap in `test.html`: `"three": "./three.module.min.js"` → vendored file present (655 KB).
- Zero external runtime URLs: `grep` for `http://`/`https://` across `engine.js`, `test.html`, `engine.css`, `test-world.json` returns nothing. (The vendored `GLTFLoader.js` itself contains two example URLs inside upstream comments only — not code, not fetched.)
- No-WebGL fallback: exact message string present, fallback `<div>` in the HUD template, `try/catch` unhides it and returns a no-op controller — reachable on any renderer-construction failure.
- jsdom smoke test (`/tmp/w3d-smoke/test.mjs`, ephemeral — fake WebGLRenderer shim + stubbed `GLTFLoader.load`, synthetic world): **26/26 passed** — eager hosted-district load at mount; placeholder/legacy/no-ref districts never load; failed hosted district keeps its 4-mesh procedural placeholder and `modelLoads.failed == 1`; successful hosted district has its placeholder removed and GLB in-scene; exactly 2 plaques (real + legacy status strings); info panel shows hosted ref, placeholder wording ×2, design-choice text; near building loads lazily in range, far building only after teleport into range; `modelLoads` totals requested 4 / loaded 3 / failed 1.
- Fixture check (`/tmp/w3d-smoke/test-fixture.mjs`): mounts the real `engine/test-world.json`: **8/8 passed** — hosted district d2 + hosted building b1 load, interior props (Crate, Stool) load, placeholder district d1 never loads, exactly 1 plaque, `modelLoads.loaded == 2`.
- `data.js` unchanged and still loads: 544 worlds + 7 flagships; totals 38 districts / 186 buildings / 44 NPCs / 34 quests / 65 collectibles; 245,141 bytes.
- `worlds/*.json` untouched (Phase 2 data intact); the 17 missing models untouched — still procedural placeholders, no substitutes invented.
- Not verified here (needs a real browser with WebGL): actual in-scene 3D rendering of a hosted district/building GLB, visual scale/fit of real staged GLBs (the fitter assumes the widest horizontal extent is the right normaliser — a tall thin model would render tall), touch controls on a device. The next worker / a browser check should open `engine/test.html` (now with a hosted district + hosted building using the locally present `Container.glb`) and confirm the scene renders, the GLBs appear in place of the procedural forms, and the quest (talk to steward → collect spark) completes.

## For the next worker (world data + lobby)

- Assume `mountWorld(container, worldDef, options)` exists exactly as above; feed it any world JSON in the test-world shape and it will render. Unknown/missing fields degrade gracefully (defaults for terrain/weather/biome; empty arrays for districts/buildings/NPCs/etc.).
- Keep `engine/` and `utils/` side by side at the build root; do not move `BufferGeometryUtils.js` into `engine/` (breaks the vendored loader's relative import) and do not edit the vendored files.
- Real fabric models are NOT hosted: use `model_status: "not hosted — procedural placeholder shown"` + `model_ref` and the engine will show the placeholder + plaque honestly. Never set a district's status to `"hosted"` unless the model file is actually present and loadable. (The engine treats any status other than exactly `"hosted"` as a placeholder, so the old `'not-hosted'` spelling also works, but the descriptive string is the canonical one in `worlds/*.json`.)
- District/building hosted models load via the queue in §13: districts eagerly at mount, buildings lazily within 120 units. Watch `state.modelLoads` in devtools (`window.__world.state.modelLoads`) to see requested/loaded/failed counts.
- Interiors reference GLB props as paths relative to the **page** (e.g. `assets/glb/Crate.glb` from a page at the build root); put real GLBs under `assets/glb/`.
- The test page exposes `window.__world` (controller) and `window.__worldDef` for devtools probing.

## 14. Depth pass (2026-11-06, 8-hour program)

Data + engine + lobby, verified by the jsdom suites in `/tmp/w3d-smoke/`
(`test.mjs` 26/26, `test-fixture.mjs` 8/8, `test-depth.mjs` 26/26,
`mobile-audit.mjs` 24/24, `perf.mjs` measurements below). No WebGL pixels —
same caveat as §13: rendering still needs a real browser check.

### 14.1 NPC dialogue + quests (data only)
- Every NPC: 2 → 5 dialogue lines (44 NPCs, 220 lines). New lines use only
  real fabric nodes: the NPC's own zone/hall, sibling Agent/Advisor nodes,
  the Steward Council (human seats), the PBC Alignment Evaluation Gate, the
  Swarm coordinator, the sign node. Original game dialogue, never attributed
  to a real person; no invented people/places/statistics.
- Every quest: 3 → 5 steps (34 quests, 170 steps). Pattern: talk giver →
  collect → visit place → talk a second NPC → report back to the giver.
  Every step target resolves (validated programmatically): npc ids,
  collectible ids, and place names that exist in the same world.
- `worlds/*.json` was rewritten by `/tmp/w3d-depth/deepen.py` with sorted
  keys + 1-space indent (formatting normalisation; content is the only
  change). `data.js` regenerated with `tools/gen_data_js.py` (267,087 B).

### 14.2 Quest bug fixed (engine): npc/place steps never advanced
- `advanceQuestStep()` was only ever called for `'collectible'` and
  `'position'` steps. Every quest's first step is "talk to X" (and several
  have "visit Y" steps), so NO quest could ever complete.
- Fixed: talking to an NPC now advances accepted `'npc'` steps for that NPC
  (in `openDialogue` and on quest accept, where the first step is usually
  "talk to this NPC"); `'place'` steps advance on proximity, checked in the
  0.5 s tick against `placeTargets` (building centre + half-diagonal, min
  6 u; district plate radius 18 u; buildings win on a name clash).
- Proved end-to-end in `test-depth.mjs`: fixture quest (talk → collect →
  complete) and an inline 3-step quest (talk → visit district → report
  back → complete).

### 14.3 Weather / skybox polish (engine)
- All 8 presets are now real HUD buttons (indoor/mist/golden-hour/breeze
  were previously only reachable via `setWeather()`).
- Presets are a `WEATHER_PRESETS` table; switching cross-fades fog colour/
  near/far, light factor, ambient, cloud/rain opacity, wind and indoor
  blend over ~1 s (`updateWeather`, exponential approach) instead of
  snapping. One persistent `THREE.Fog` instance (clear = far 1200/near 400,
  effectively no fog) instead of toggling `scene.fog`.
- Light-persistence bug fixed: `applyTimeOfDay` (every frame) now applies
  the lerped weather light factor and indoor blend itself. Previously
  `applyWeather` multiplied `sunLight.intensity` once and the next frame's
  day-cycle write overwrote it — rain/clouds/mist never dimmed the light
  and indoor reverted after one frame. Proved in `test-depth.mjs`: indoor
  holds sun-hidden / stars-0 / ambient 0.55 / sun ~1.5 for 2.5 s of frames.
- Skybox: horizon-glow band in the dome shader (warm at dusk, deep blue at
  night), second dimmer star layer (450 points, size 1.2) + ±12% twinkle,
  moon halo disc. Rain now wraps in a 120×120×60 box centred on the avatar
  (never rains at the origin after the player walks away) with wind slant
  (preset wind × 14 u/s) and opacity tied to the cross-fade.

### 14.4 Performance (measured, jsdom — JS cost only, no GPU/canvas)
- Mount (all 7 real flagships): 39–656 ms first run, 86–581 ms second run
  (range is jsdom rAF/JIT noise; Holodeck, the largest world at 1,741 scene
  objects / 947 meshes / 381 sprites, mounts in 139–581 ms). Frame
  throughput in jsdom: 122–184 frames/3 s (~16–25 ms/frame) — jsdom-bound,
  not a browser number; do not quote as real frame rate.
- 0.5 s tick cost at Holodeck scale (130 place/lazy targets): 0.005–0.008 ms
  per scan — no reason to change the interval. The lazy scan now stops
  entirely once every lazy model has started (`lazyScanDone`); all 7 real
  worlds have 0 lazy models (no hosted buildings), so the scan is already a
  no-op there. `MAX_CONCURRENT_LOADS = 2` and `LAZY_LOAD_RADIUS = 120`
  unchanged — no measurement supported changing them, and the first frame
  is untouched (districts eager, buildings lazy, as before).
- Two analytic wins (canvas counts measured in jsdom, time win is
  real-browser-only since jsdom stubs canvas 2d): `buildingTexture` cached
  by colour (Holodeck: 122 builds → 8) and label sprites cached by
  text/style (Holodeck: 390 → 269 canvases at mount, saving the 121
  identical "EXIT → outside" labels). Output identical in both cases.
- `applyTimeOfDay` no longer allocates 8 `THREE.Color`s per frame (sky
  colours hoisted to module scope). Known remaining cost, unchanged
  deliberately: 381 label sprites in the Holodeck = 381 draw calls;
  distance-culled labels would be a future visual change, not a silent one.

### 14.5 Lobby + mobile
- Flagship cards now show weather preset (+ day cycle / fixed time), the
  first quest ("Start with: … — 5 steps") and companion names.
- Pagination is windowed page numbers (1 … p-1 p p+1 … last) with
  `aria-current="page"`; the result count echoes the active search/biome/
  group filters. Honesty banner and "does not resolve yet" subdomain labels
  unchanged.
- Mobile (390px) static audit (`mobile-audit.mjs`, 24/24): no unguarded
  fixed width over the 354px content column in either stylesheet; grid min
  280px, search basis 220px, dialog/controls/toast/panel all vw-guarded.
  One real fix: `#info-toggle` was `position:absolute` against the viewport
  and could overlay the world title at 390px — now an in-flow flex item in
  the player bar (wraps with it). Still unverified in a real browser: actual
  390px rendering, overflow, overlap and tap targets need a layout engine.
