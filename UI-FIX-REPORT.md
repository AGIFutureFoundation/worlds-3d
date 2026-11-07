# UI Controls Fix — Worlds 3D + Worlds Showcase (2026-11-07)

Local only. Nothing pushed, shared, posted, or sent.

## What was blocking the view (before)

Player (`player.html` + `engine/engine.js`, the 7 playable flagships
including the AGI Corp Hub):

- Quest tracker (top-left, 240px), About panel (bottom-left, 240px) and the
  weather/time bar (bottom-centre, up to 480px) had **no close, no
  minimise, no size control** and no way to get them back once hidden —
  they permanently covered the left and bottom-centre of the 3D view.
- The info sidebar (`#info-panel`, 320px) had only the top-bar
  "World info" toggle; on desktop it was open by default and shrank the
  canvas, with no ×, no minimise, no size.
- The NPC dialogue box (bottom-centre, 460px) had a Close button but no
  minimise/size, and no way to shrink it mid-conversation.
- There was **no hide-all**: no button and no key to clear the view.
- The top bar and the collect/compass counters had no controls at all.

Lobby (`index.html`): the filter bar is in-flow page content, not an
overlay — its only gap was no collapse toggle.

Worlds Showcase (`files/rp1-review/worlds-showcase/index.html`, the 35-world
3D viewer): already had Clean view (H) hiding HUD/map/help/caption/Sky/
near panels, but the world picker (`#wlist`, up to 560px wide on the right)
had no × and no size, and Clean view did **not** hide the picker.

## What changed

### `worlds-3d/engine/engine.js` + `engine/engine.css`
- Every HUD panel is now a `.w3d-panel` with a head row: **⤢ size** (small /
  medium / large, where the panel has a body worth resizing), **– minimise**
  (collapses to a header bar; clicking the collapsed head re-expands it),
  **× close**. Panels: title bar, Quests, counters, Weather & time,
  About this place, dialogue, touch controls.
- **▦ Panels menu** (floating, bottom-right): lists every panel with its
  state (open / collapsed / closed); tapping a row shows or hides it — this
  is how closed panels come back.
- **Global hide-all**: floating "🙈 Hide UI" button (bottom-right) + **H key**
  hides every panel at once; a minimal gold "👁 Show UI (H)" pill stays
  visible in the bottom-right corner to restore them. Esc closes an open
  dialogue, otherwise restores hidden UI. H is ignored while typing in a
  field (e.g. the time slider). Hiding also fires a `worlds3d:ui` event so
  the outer page hides with the HUD.
- Talking to an NPC while the UI is hidden restores the UI first, so the
  conversation is visible.
- New controller API: `toggleUI()`, `setUIHidden(bool)`, `isUIHidden()`,
  `setPanel(id, state)`, `getPanelStates()` (no-op versions on the no-WebGL
  fallback controller, so callers never crash).
- Deliberate exceptions (documented in code): the dialogue is not in the
  Panels menu — closing it ends the conversation and talking to an NPC
  again reopens it; touch controls have no on-canvas × (an accidental tap
  while moving would strand a mobile player) and are hidden/shown via
  hide-all and the Panels menu; the top bar and counters are single-line
  status bars, so their size step is a compact toggle (top bar hides its
  tag line) / collapse-to-compass (counters).
- Mobile: the bottom-centre controls leave a 64px right-hand gutter so
  they never sit under the Hide UI pill; head buttons are 44px on coarse
  pointers. The no-WebGL fallback is never hidden by hide-all.

### `worlds-3d/player.html` + `player.js` + `site.css`
- Player bar gains a "🙈 Hide UI (H)" button (calls the engine toggle).
- On `worlds3d:ui` the page hides the top bar and the info sidebar with
  the HUD; the engine's floating Show UI pill (inside `#app`) is the
  restore control.
- Info sidebar gains a header row: **⤢ Size** (260 / 320 / 440px; on
  mobile the slide-over widths are 70vw / 86vw / 92vw), **– minimise** to
  the header bar, **× close** (reopen from the World info button). The
  sidebar content now lives in `#info-body` so the header survives
  re-renders.

### `worlds-3d/index.html` + `lobby.js` + `site.css`
- Filter bar gets a "▾ Filters / ▸ Show filters" collapse toggle.

### `worlds-3d/engine/test.html`
- Self-check log now also reports `toggleUI/setUIHidden/setPanel/isUIHidden`.

### `files/rp1-review/worlds-showcase/index.html`
- World picker (`#wlist`) gains a header row: title + **⤢ Size**
  (560 / 340 / 760px) + **× close**. Clean view (H) now also closes/hides
  the picker, and opening the picker while in Clean view exits Clean view
  (otherwise the list would stay invisible while claiming to be open).
- Not changed: `#near` / `#hud` / `#caption` have no individual × — they
  are covered by the existing Clean view (H), and `#near`'s content is
  re-rendered by `setNear()`, so a static header would be wiped. The Sky
  panel (`#env`) is a native `<details>` disclosure — that is its minimise.

## Scope note
- The editable source for this track is the **worlds-3d** build (7 playable
  flagships: AGI Corp Hub + 6 anchored worlds). Two byte-identical copies
  exist and were kept in sync: `~/workspace/goals/agi-corp-worlds-on-rp1/files/worlds-3d/`
  and `~/workspace/your_files/worlds-3d/`.
- The **40 agi-corp-worlds** live in the private repo
  `AGIFutureFoundation/agi-corp-worlds` — there is no local clone and the
  repo API returns 404 (per the Phase 2 report). They are lobby index
  entries only, not playable here, so no UI fix could be applied to them.
  The fix needs that repo cloned (or its live files located) first.
- No tour / waypoint / companion / session behaviour was changed: the only
  behavioural additions are the panel controls, the H/Esc keys, and
  dialogue auto-restoring hidden UI. Weather, time, quests, dialogue,
  collectibles, interiors, and movement code are untouched.

## Verification (all local)
- Syntax: `node --check` lobby.js OK; `node --input-type=module --check`
  engine.js, player.js, showcase inline script OK; CSS braces/parens
  balanced (site.css 150/150, engine.css 92/92).
- DOM test (jsdom, real sources, minimal THREE stub, no-WebGL fallback
  path): **38/38 checks passed** — hide-all + restore pill, Panels menu
  reopen, minimise/expand, size cycles, topbar/counters/info/dialogue
  controls, player-bar Hide UI + `worlds3d:ui` event, lobby filters,
  flagship rendering. Harness: `~/workspace/.ui-fix-check/dom-test.cjs`
  (jsdom assembled from the bun cache via symlinks; the Playwright/Chromium
  smoke attempt could not run — headless Chromium SIGTRAPs at launch in
  this sandbox, and loopback HTTP from exec is blocked, so the browser
  test was replaced by the jsdom test).
- **NOT verified here — needs Mike's devices:** real WebGL rendering in a
  desktop browser and on a phone; the H key and the live (non-fallback)
  controller; dialogue open/minimise during live play; touch layout on a
  real phone (joystick vs controls overlap on narrow screens is
  pre-existing and unchanged); Quest headset behaviour; the Showcase
  picker/Clean-view changes in a real browser (syntax-checked only —
  the page needs its three.js CDN script and canvas 2D, which jsdom
  cannot run).

## Ready for approval
The fix is ready for Mike to approve for push (worlds-3d repo, per
`DEPLOY-PLAN.md` — new `AGIFutureFoundation/worlds-3d` repo, not yet
created) after he playtests on his desktop browser, phone, and headset.
Nothing has been pushed.
