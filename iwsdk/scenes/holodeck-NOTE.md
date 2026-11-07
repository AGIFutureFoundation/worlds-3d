# Holodeck scene variant — STAGED, NOT ACTIVE (Phase 3, 2026-11-07)

`holodeck.iwsdk.scene.json` is the SmartCiti.X Holodeck composition
variant of `main.iwsdk.scene.json`: same DomeGradient / IBLGradient
environment, same key/fill light nodes, but the lights carry the
Holodeck fabric values from `my-fabric/holodeck.json`
(Phase 1 collection §4.9):

- Key (directional) light: intensity **0.6**, colour **0xFFF4E0**
  (warm) — main scene has 2.3 / 0xFFF1DE-ish.
- Fill (hemisphere) light: intensity **0.12**, white sky and ground —
  main scene has 1.15.

## Status

- **Not wired.** `iwsdk.config.json` selects one scene
  (`./public/scenes/main.iwsdk.scene.json`) and the project has no
  per-world scene switch, so this file is staged only.
- **The same values are live in code.** `WeatherSystem` applies the
  fabric lighting at runtime whenever the loaded world is
  `smartciti-holodeck` (see `src/systems/weather.js` + `HOLODECK_LIGHTING`
  in `src/data/holodeck-fabric.js`), so the deck already renders with
  ambient 0.12 / directional 0.6 warm in the running app.
- **To activate this file** (a future step, needs Mike's go-ahead):
  point `iwsdk.config.json`'s `scene` at this file for a Holodeck-only
  build, or add a per-world scene switch — and re-verify the live
  render, since the runtime WeatherSystem override would then be
  redundant with the scene values.

Do not present this file as the live scene: the live scene is still
`main.iwsdk.scene.json`.
