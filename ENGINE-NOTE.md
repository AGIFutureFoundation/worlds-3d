# worlds-3d Engine — Note

Build folder: `~/workspace/your_files/worlds-3d/`
Engine: plain Three.js r160, ES modules, no backend, no runtime CDN. All files local; works from `file://` and GitHub Pages with relative paths only.

## Files

| File | Size | What it is |
|---|---|---|
| `engine/three.module.min.js` | 655 KB | Vendored Three.js r160 (three@0.160.0, downloaded once from unpkg at build time) |
| `engine/GLTFLoader.js` | 106 KB | Vendored GLTFLoader r160, unmodified |
| `utils/BufferGeometryUtils.js` | 31 KB | Vendored r160 helper — **required**: stock GLTFLoader imports `../utils/BufferGeometryUtils.js` relative to `engine/`, so it must live at build-root `utils/`, not under `engine/`. Only deviation from the contract layout, and the reason is upstream's own relative import (editing the vendored loader was avoided so it stays byte-identical to upstream). |
| `engine/engine.js` | 44 KB | The engine (see API below) |
| `engine/engine.css` | 5.7 KB | HUD + touch controls, responsive |
| `engine/test-world.json` | 1.5 KB | Test fixture in the contract schema shape |
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
7. Buildings: procedural boxes with a canvas-drawn window texture (no external images), cone roof, door mesh + door trigger. Interiors: walking to a door and pressing E / Interact teleports into an interior room built at y = −120 (room box + floor + ceiling light + props); props load via GLTFLoader from local `assets/glb/` paths with a procedural crate fallback if the GLB is missing/fails. Blue EXIT pad + Interact returns outside. Interior labels say "game space".
8. Districts: coloured ground plates + floating name sprites + procedural placeholder arch/plinth. When `model_status` is `"not-hosted"`, a "model not hosted — placeholder" plaque appears in-world and the same wording appears in the HUD info panel (plus any `missing_models[]` entries). Placeholders are never presented as the real model.
9. Avatar: third-person capsule + name label, orbit camera; WASD/arrows, Space jump, Shift run; collision = terrain height + push-out from building AABBs (clamped to room bounds indoors). Touch: left virtual joystick, right-side drag to look, on-screen Jump + Interact buttons (shown on coarse pointers). Agent companions follow at an offset and show a greeting toast when approached — the toast uses the companion's `greeting` field when present (Phase 2: each companion's greeting reflects its real ACP job + price and states its live instance is offline), otherwise the generic guide line.
10. NPCs: capsule figures + name/role labels; E / Interact opens a dialogue panel cycling that NPC's lines; "Accept quest" button when the NPC has a quest.
11. Quests + collectibles: HUD quest tracker (title, current step, n/N progress); steps complete by talking to an NPC, collecting a collectible, or reaching a target position. Collectibles are rotating floating meshes — spark = gold octahedron, relic = purple icosahedron, data = cyan box — with a ground halo; walking into one collects it (HUD counter + toast). Completing the last step shows a "Quest complete" toast with the reward text.
12. HUD: top bar (world name + status badge + "Web 3D interpretation — not on RP1"), quest tracker, collectible counter, compass strip (N/NE/E/… from camera yaw), weather buttons + time-of-day slider, info panel (districts + missing-model notes + sources). Responsive CSS + viewport meta; info panel hides on coarse-pointer/small screens.

Performance: instanced foliage, static-draw usage, reused `Vector3/Matrix4/Quaternion` temporaries in the hot loop (no per-frame allocations there except unavoidable small ones in toast/quest rendering, which are event-driven, not per-frame).

## Controls

- Keyboard: WASD / arrow keys move (camera-relative), Space jump, Shift run, E interact / talk / enter building.
- Touch: left joystick move, drag right half of screen to look, Jump + Interact buttons.
- HUD: weather preset buttons, time-of-day slider (0–24 h).

## What was verified (2026-11-06, node/python only — no browser available to this worker)

- `node --check` (as `.mjs` copies): `engine.js` OK, `GLTFLoader.js` OK, `BufferGeometryUtils.js` OK, `test.html` inline module script OK.
- Real module import in Node (temp dir mirroring the real layout + a `node_modules/three` shim for the bare specifier): `import('./engine/engine.js')` loads, exports `mountWorld` as a function — the full import graph resolves, including GLTFLoader → `../utils/BufferGeometryUtils.js`.
- `test-world.json` parses; all contract keys present; district `not-hosted`, 1 interior room with 2 GLB props, NPC quest `q1` with npc + collectible steps.
- Importmap in `test.html`: `"three": "./three.module.min.js"` → vendored file present (655 KB).
- Zero external runtime URLs: `grep` for `http://`/`https://` across `engine.js`, `test.html`, `engine.css`, `test-world.json` returns nothing. (The vendored `GLTFLoader.js` itself contains two example URLs inside upstream comments only — not code, not fetched.)
- No-WebGL fallback: exact message string present, fallback `<div>` in the HUD template, `try/catch` unhides it and returns a no-op controller — reachable on any renderer-construction failure.
- Not verified here (needs a real browser): actual WebGL rendering, visual check of sky/weather/interiors, touch controls on a device, GLB prop loading with a real file (fallback path is coded; `assets/glb/` is currently empty). The next worker / a browser check should open `engine/test.html` and confirm the scene renders and the quest (talk to steward → collect spark) completes.

## For the next worker (world data + lobby)

- Assume `mountWorld(container, worldDef, options)` exists exactly as above; feed it any world JSON in the test-world shape and it will render. Unknown/missing fields degrade gracefully (defaults for terrain/weather/biome; empty arrays for districts/buildings/NPCs/etc.).
- Keep `engine/` and `utils/` side by side at the build root; do not move `BufferGeometryUtils.js` into `engine/` (breaks the vendored loader's relative import) and do not edit the vendored files.
- Real fabric models are NOT hosted: use `model_status: "not-hosted"` + `model_ref` and the engine will show the placeholder + plaque honestly. Never set a district's status to anything else unless the model file is actually present and loadable.
- Interiors reference GLB props as paths relative to the **page** (e.g. `assets/glb/Crate.glb` from a page at the build root); put real GLBs under `assets/glb/`.
- The test page exposes `window.__world` (controller) and `window.__worldDef` for devtools probing.
