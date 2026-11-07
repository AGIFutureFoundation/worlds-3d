// worlds-3d engine — plain Three.js r160, no backend, no runtime CDN.
// Vendored Three.js source: three@0.160.0 (unpkg, downloaded once at build time).
// Everything below runs from file:// or GitHub Pages with relative paths only.
// Depth-2 (2026-11-07): weather presets differentiated (dusk vs golden-hour,
// rain darker, per-preset star dimming); perf: cached HUD refs, shared label
// materials, queued interior props, typed-array rain loop, mobile pixel-ratio cap 1.5.
import * as THREE from 'three';
import { GLTFLoader } from './GLTFLoader.js';

const NO_WEBGL_MSG = '3D needs WebGL — your browser/device does not provide it';
const BIOMES = {
  city:     { ground: 0x6f7d6a, ground2: 0x5d6e5a, tree: 0x2f7a3d, tree2: 0x3f9a4d, grass: 0x4c9a3f, trunk: 0x6b4a2f, density: 0.7 },
  forest:   { ground: 0x4a6b3a, ground2: 0x3d5c31, tree: 0x1f6b2e, tree2: 0x2f8a3e, grass: 0x3f8a2f, trunk: 0x5a3d24, density: 1.0 },
  desert:   { ground: 0xc2a06b, ground2: 0xb08d55, tree: 0x6b8a3a, tree2: 0x7a9a3a, grass: 0xa88a4a, trunk: 0x7a5a30, density: 0.25 },
  coastal:  { ground: 0x7d9a6a, ground2: 0xc2b280, tree: 0x2f7a4d, tree2: 0x3f9a5d, grass: 0x5a9a4f, trunk: 0x6b4a2f, density: 0.6 },
  snow:     { ground: 0xdde6ee, ground2: 0xc8d4de, tree: 0x1f5a3a, tree2: 0x2f6b4a, grass: 0xbcd0dd, trunk: 0x4a3524, density: 0.5 },
};
const COLLECTIBLE_STYLE = {
  spark: { color: 0xffd23f, geo: 'octa' },
  relic: { color: 0xb26bff, geo: 'icosa' },
  data:  { color: 0x35d0ff, geo: 'box' },
};

// --- hosted-model status rules (single source of truth for Task 1/2) ---
// A district/building model is HOSTED iff it has a model_ref AND its status is
// exactly 'hosted'. Anything else with a model_ref is a PLACEHOLDER: the
// canonical data writes the placeholder status as
// "not hosted — procedural placeholder shown" (tools/rewire_models.py
// PLACEHOLDER_STATUS); older fixtures use 'not-hosted'. Checking for
// `!== 'hosted'` instead of matching one placeholder spelling keeps the
// plaque and the info panel correct for both spellings and for any future
// non-hosted wording. A district with no model_ref at all (e.g. the Hub
// lobby, a design choice) is neither hosted nor a placeholder.
function isHostedModel(item) { return !!item && !!item.model_ref && item.model_status === 'hosted'; }
function isPlaceholderModel(item) { return !!item && !!item.model_ref && item.model_status !== 'hosted'; }

// --- deterministic noise (seeded, shared by mesh + walk height) ---
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  const grad = (h, x, y) => { switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; } };
  return function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const h00 = perm[(perm[xi & 255] + yi) & 255], h10 = perm[(perm[(xi + 1) & 255] + yi) & 255];
    const h01 = perm[(perm[xi & 255] + yi + 1) & 255], h11 = perm[(perm[(xi + 1) & 255] + yi + 1) & 255];
    const u = fade(xf), v = fade(yf);
    const a = grad(h00, xf, yf), b = grad(h10, xf - 1, yf);
    const c = grad(h01, xf, yf - 1), d = grad(h11, xf - 1, yf - 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 0.7071;
  };
}

// --- canvas helpers (no external images) ---
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeLabelSprite(text, opts = {}) {
  const { font = 44, fg = '#ffffff', bg = 'rgba(10,16,32,0.82)', pad = 18 } = opts;
  // One canvas texture per distinct label text/style, shared by every
  // sprite that shows it: the Holodeck repeats "EXIT → outside" 122 times
  // (one per building interior), so an uncached build rasterised 122
  // identical 512x128 canvases. Sharing the texture is identical output —
  // scale lives on the Sprite, not the material.
  const key = text + '|' + font + '|' + fg + '|' + bg + '|' + pad;
  let tex = labelTextureCache.get(key);
  if (!tex) {
    tex = canvasTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(6, 14, w - 12, h - 28, 18); ctx.fill();
      ctx.fillStyle = fg; ctx.font = `bold ${font}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text.length > 26 ? text.slice(0, 25) + '…' : text, w / 2, h / 2);
    });
    labelTextureCache.set(key, tex);
  }
  // Materials are shared per cache key too (same texture + style always
  // produced the same material); per-sprite state lives on the Sprite.
  let mat = labelMaterialCache.get(key);
  if (!mat) {
    mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    labelMaterialCache.set(key, mat);
  }
  const s = new THREE.Sprite(mat); s.scale.set(10, 2.5, 1); return s;
}
const labelTextureCache = new Map();
const labelMaterialCache = new Map(); // one SpriteMaterial per (texture, style):
// the Holodeck's 122 'EXIT → outside' labels shared one texture but built 122 materials.
// Reused sky colours — applyTimeOfDay runs every frame, so these live
// here (module scope) instead of being allocated 8x per frame.
const SKY_DAY_TOP = new THREE.Color(0x2f6fd0), SKY_DAY_BOT = new THREE.Color(0xcfe8f5);
const SKY_NIGHT_TOP = new THREE.Color(0x050914), SKY_NIGHT_BOT = new THREE.Color(0x0e1a2e);
const SKY_DUSK_TOP = new THREE.Color(0x5a3a6b), SKY_DUSK_BOT = new THREE.Color(0xff9a5a);
const SKY_HORIZON_DAY = new THREE.Color(0xdfeef8), SKY_HORIZON_DUSK = new THREE.Color(0xff9a5a);
const SKY_HORIZON_NIGHT = new THREE.Color(0x1a2f4a);
function buildingTexture(baseColor) {
  // One canvas per distinct colour, shared by every building that uses it:
  // the Holodeck builds 122 buildings from ~8 district colours, so an
  // uncached build would rasterise 122 identical 256x256 canvases at mount.
  // Output is identical — same colour always produced the same canvas.
  let tex = buildingTextureCache.get(baseColor);
  if (tex) return tex;
  tex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseColor; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, 0, w, 10);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
      const lit = ((row * 5 + col) % 3) !== 0;
      ctx.fillStyle = lit ? '#ffe9a8' : '#1c2733';
      ctx.fillRect(18 + col * 46, 30 + row * 52, 30, 34);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeRect(18 + col * 46, 30 + row * 52, 30, 34);
    }
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(w / 2 - 18, h - 52, 36, 52); // door
  });
  buildingTextureCache.set(baseColor, tex);
  return tex;
}
const buildingTextureCache = new Map();
function waterTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1d6f8e'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(8 + i * 14, 10 + ((i * 37) % 100));
      ctx.quadraticCurveTo(30 + i * 10, 30 + ((i * 53) % 80), 60 + i * 8, 20 + ((i * 29) % 90)); ctx.stroke();
    }
  });
}

// Reused temporaries — no per-frame allocation in the hot loop.
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1);

export function mountWorld(container, worldDef, options = {}) {
  const def = worldDef || {};
  const opts = Object.assign({ startHour: 10, weather: null, dayCycle: true }, options);
  const biome = BIOMES[def.biome] || BIOMES.city;
  const terrainDef = Object.assign({ size: 400, height: 2, seed: 7, water: false }, def.terrain || {});
  const noise = makeNoise(terrainDef.seed);
  const heightAt = (x, z) => {
    const s = terrainDef.size;
    const nx = x / s * 6, nz = z / s * 6;
    const edge = Math.max(Math.abs(x), Math.abs(z)) / (s / 2); // flatten near borders
    const fall = Math.max(0, 1 - Math.max(0, edge - 0.75) * 4);
    return (noise(nx, nz) * 0.6 + noise(nx * 2.3 + 5, nz * 2.3 + 5) * 0.4) * terrainDef.height * fall;
  };

  const state = {
    world: def, webgl: false, running: false, hour: opts.startHour,
    weather: (opts.weather || (def.weather && def.weather.preset) || 'clear'),
    dayCycle: def.weather ? def.weather.dayCycle !== false : opts.dayCycle,
    collected: [], questsAccepted: {}, questProgress: {}, questsComplete: {},
    position: def.spawn ? def.spawn.slice() : [0, 2, 24],
    nearNPC: null, nearBuilding: null, insideBuilding: null, companionGreeted: false,
    modelLoads: { requested: 0, loaded: 0, failed: 0 }, // hosted-GLB load counts
  };

  // ---------- HUD (built first so the no-WebGL fallback can reuse it) ----------
  container.classList.add('w3d-container');
  const hud = document.createElement('div'); hud.className = 'w3d-hud'; container.appendChild(hud);
  hud.innerHTML = `
    <div class="w3d-topbar w3d-panel w3d-panel-head" data-panel="topbar">
      <div class="w3d-title"><strong></strong><span class="w3d-badge"></span></div>
      <div class="w3d-label">Web 3D interpretation — not on RP1</div>
      <span class="w3d-panel-btns">
        <button type="button" data-w3d-action="size" data-w3d-panel="topbar" title="Compact title bar (hide the tag line)">⤢</button>
        <button type="button" data-w3d-action="close" data-w3d-panel="topbar" title="Close the title bar (reopen from Panels)">×</button>
      </span>
    </div>
    <div class="w3d-quest w3d-panel" data-panel="quest"><div class="w3d-panel-head"><h3>Quests</h3><span class="w3d-panel-btns"><button type="button" data-w3d-action="size" data-w3d-panel="quest" title="Change panel size (small / medium / large)">⤢</button><button type="button" data-w3d-action="minimise" data-w3d-panel="quest" title="Minimise panel" aria-expanded="true">–</button><button type="button" data-w3d-action="close" data-w3d-panel="quest" title="Close panel (reopen from Panels)">×</button></span></div><div class="w3d-panel-body"><div class="w3d-quest-body">No quest accepted yet.</div></div></div>
    <div class="w3d-counters w3d-panel" data-panel="counters"><span class="w3d-panel-btns"><button type="button" data-w3d-action="minimise" data-w3d-panel="counters" title="Minimise counters (keeps the compass)" aria-expanded="true">–</button><button type="button" data-w3d-action="close" data-w3d-panel="counters" title="Close counters (reopen from Panels)">×</button></span><span class="w3d-collect">✦ 0 collected</span><span class="w3d-compass">N</span></div>
    <div class="w3d-controls w3d-panel" data-panel="controls">
      <div class="w3d-panel-head"><span class="w3d-panel-title">Weather &amp; time</span><span class="w3d-panel-btns"><button type="button" data-w3d-action="size" data-w3d-panel="controls" title="Change panel size (small / medium / large)">⤢</button><button type="button" data-w3d-action="minimise" data-w3d-panel="controls" title="Minimise panel" aria-expanded="true">–</button><button type="button" data-w3d-action="close" data-w3d-panel="controls" title="Close panel (reopen from Panels)">×</button></span></div>
      <div class="w3d-panel-body">
      <div class="w3d-weather" role="group" aria-label="Weather">
        <button data-weather="clear">☀ Clear</button><button data-weather="cloudy">☁ Cloudy</button>
        <button data-weather="rain">🌧 Rain</button><button data-weather="dusk">🌆 Dusk</button>
        <button data-weather="indoor">🏠 Indoor</button><button data-weather="mist">🌫 Mist</button>
        <button data-weather="golden-hour">🌅 Golden hour</button><button data-weather="breeze">🍃 Breeze</button>
      </div>
      <label class="w3d-time">🕐 <input type="range" min="0" max="24" step="0.25" value="${state.hour}" aria-label="Time of day"> <span class="w3d-clock"></span></label>
      </div>
    </div>
    <div class="w3d-info w3d-panel" data-panel="info"><div class="w3d-panel-head"><h3>About this place</h3><span class="w3d-panel-btns"><button type="button" data-w3d-action="size" data-w3d-panel="info" title="Change panel size (small / medium / large)">⤢</button><button type="button" data-w3d-action="minimise" data-w3d-panel="info" title="Minimise panel" aria-expanded="true">–</button><button type="button" data-w3d-action="close" data-w3d-panel="info" title="Close panel (reopen from Panels)">×</button></span></div><div class="w3d-panel-body"><div class="w3d-info-body"></div></div></div>
    <div class="w3d-dialog w3d-panel" data-panel="dialog" hidden><div class="w3d-panel-head"><h3 class="w3d-dialog-name"></h3><span class="w3d-panel-btns"><button type="button" data-w3d-action="size" data-w3d-panel="dialog" title="Change panel size (small / medium / large)">⤢</button><button type="button" data-w3d-action="minimise" data-w3d-panel="dialog" title="Minimise dialogue" aria-expanded="true">–</button><button type="button" data-w3d-action="close" data-w3d-panel="dialog" title="Close dialogue">×</button></span></div>
      <div class="w3d-panel-body"><p class="w3d-dialog-line"></p>
      <div class="w3d-dialog-btns"><button class="w3d-dialog-next">Next ▸</button>
      <button class="w3d-dialog-quest" hidden>Accept quest</button>
      <button class="w3d-dialog-close">Close</button></div></div></div>
    <div class="w3d-toast" hidden></div>
    <div class="w3d-touch w3d-panel" data-panel="touch"><div class="w3d-joy"><div class="w3d-joy-knob"></div></div>
      <div class="w3d-touch-btns"><button class="w3d-btn-jump">Jump</button><button class="w3d-btn-interact">Interact</button></div></div>
    <div class="w3d-ui-fab"><button class="w3d-ui-toggle" type="button" aria-pressed="false" title="Hide all panels (H)">🙈 Hide UI</button><button class="w3d-panels-btn" type="button" aria-expanded="false" aria-controls="w3d-panels-menu" title="Show or hide individual panels">▦ Panels</button></div>
    <div class="w3d-panels-menu" id="w3d-panels-menu" hidden></div>
    <div class="w3d-ui-restore" hidden><button type="button" title="Show all panels (H)">👁 Show UI (H)</button></div>
    <div class="w3d-fallback" hidden><p>${NO_WEBGL_MSG}</p><p class="w3d-fallback-sub">This world is a WebGL experience. Try a recent desktop or mobile browser with hardware acceleration enabled.</p></div>`;
  const $ = (sel) => hud.querySelector(sel);
  // Cached HUD refs: applyTimeOfDay runs every frame, so the time slider
  // and clock are looked up once here, not re-queried 60x/s. (Depth-2.)
  const timeInput = $('.w3d-time input');
  const clockElTop = $('.w3d-clock');
  $('.w3d-title strong').textContent = def.name || 'Untitled World';
  const badge = $('.w3d-badge'); badge.textContent = (def.status || 'demo').toUpperCase();
  badge.classList.add('w3d-badge-' + (def.status || 'demo'));
  const infoBody = $('.w3d-info-body');
  const missing = def.missing_models || [];
  infoBody.innerHTML = (def.districts || []).map((d) => {
    if (isHostedModel(d)) {
      return `<div class="w3d-district-row"><strong>${escapeHtml(d.name)}</strong> — ` +
        `model: ${escapeHtml(d.model_ref)}</div>`;
    }
    if (isPlaceholderModel(d)) {
      return `<div class="w3d-district-row"><strong>${escapeHtml(d.name)}</strong> — ` +
        `<em>model not hosted — placeholder</em></div>`;
    }
    // No model_ref at all (e.g. the Hub lobby): neither hosted nor placeholder.
    return `<div class="w3d-district-row"><strong>${escapeHtml(d.name)}</strong> — ` +
      (d.model_status ? escapeHtml(d.model_status) : 'model: —') + `</div>`;
  }).join('') || '<div>No districts in this world.</div>';
  if (missing.length) infoBody.innerHTML += missing.map((m) =>
    `<div class="w3d-district-row">⚠ ${escapeHtml(m.ref)} — ${escapeHtml(m.status)}</div>`).join('');
  if (def.sources) infoBody.innerHTML += `<div class="w3d-district-row w3d-sources">Sources: ${def.sources.map(escapeHtml).join(', ')}</div>`;

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(msg, ms = 3500) {
    const t = $('.w3d-toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(t._timer); t._timer = setTimeout(() => { t.hidden = true; }, ms);
  }
  function fmtHour(h) { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }

  // ---------- Panel controls: close / minimise / size / hide-all (2026-11-07) ----------
  // Every HUD panel gets a close (×) and a minimise (–) button and, where the
  // panel has a body worth resizing, a size step (⤢ small/medium/large).
  // Closed panels are re-openable from the ▦ Panels menu. H (or the Hide UI
  // button) hides every panel at once for a clear view of the world; a minimal
  // Show UI pill stays visible in the bottom-right corner to restore them.
  // Exceptions, by design: the dialogue is not in the Panels menu — closing it
  // ends the conversation and talking to an NPC again reopens it; the touch
  // controls have no on-canvas × (an accidental tap while moving would strand
  // a mobile player) and are hidden/shown via Hide-all and the Panels menu;
  // the top bar and counters are single-line status bars, so their size step
  // is a compact toggle (top bar) / collapse-to-compass (counters), not S/M/L.
  const PANEL_DEFS = [
    { id: 'topbar', label: 'Title bar' },
    { id: 'quest', label: 'Quests', sizes: ['s', 'm', 'l'] },
    { id: 'counters', label: 'Counters' },
    { id: 'controls', label: 'Weather & time', sizes: ['s', 'm', 'l'] },
    { id: 'info', label: 'About this place', sizes: ['s', 'm', 'l'] },
    { id: 'dialog', label: 'Dialogue', sizes: ['s', 'm', 'l'] },
    { id: 'touch', label: 'Touch controls' },
  ];
  const panelEls = {};
  PANEL_DEFS.forEach((d) => { panelEls[d.id] = hud.querySelector('[data-panel="' + d.id + '"]'); });
  const panelState = {}; // id -> 'open' | 'collapsed' | 'closed' (default 'open')
  const panelSize = {};  // id -> size index, or null until the user picks a size (no class = default CSS size)
  PANEL_DEFS.forEach((d) => { panelState[d.id] = 'open'; panelSize[d.id] = null; });
  let uiHidden = false;
  function isTypingTarget(t) {
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }
  function renderPanelsMenu() {
    const menu = hud.querySelector('.w3d-panels-menu');
    if (!menu) return;
    const rows = PANEL_DEFS.filter((d) => d.id !== 'dialog').map((d) => {
      const st = panelState[d.id];
      const mark = st === 'open' ? '✓' : st === 'collapsed' ? '–' : '×';
      return '<button type="button" data-w3d-menu-panel="' + d.id + '">'
        + '<span>' + escapeHtml(d.label) + '</span><span>' + mark + ' ' + st + '</span></button>';
    }).join('');
    menu.innerHTML = '<div class="w3d-panels-menu-title">Panels — tap to show / hide</div>' + rows;
  }
  function applyPanelState(id) {
    const el = panelEls[id];
    if (!el) return;
    const st = panelState[id];
    el.classList.toggle('w3d-closed', st === 'closed');
    el.classList.toggle('w3d-collapsed', st === 'collapsed');
    const def = PANEL_DEFS.find((d) => d.id === id);
    if (def && def.sizes) {
      el.classList.remove('w3d-size-s', 'w3d-size-m', 'w3d-size-l');
      if (panelSize[id] !== null && panelSize[id] !== undefined) el.classList.add('w3d-size-' + def.sizes[panelSize[id]]);
    }
    // Minimise button shows ▸ when collapsed, – when open.
    const minBtn = el.querySelector('[data-w3d-action="minimise"]');
    if (minBtn) { minBtn.textContent = st === 'collapsed' ? '▸' : '–'; minBtn.setAttribute('aria-expanded', String(st !== 'collapsed')); }
    renderPanelsMenu();
  }
  function setPanel(id, state) {
    if (!panelEls[id] || !(id in panelState)) return;
    if (id === 'dialog' && state === 'closed') { closeDialog(); return; }
    panelState[id] = state;
    applyPanelState(id);
  }
  function cyclePanelSize(id) {
    const def = PANEL_DEFS.find((d) => d.id === id);
    if (!def || !def.sizes) {
      // No stepped sizes: compact toggle (top bar hides its tag line).
      const el = panelEls[id];
      if (el) el.classList.toggle('w3d-compact');
      return;
    }
    panelSize[id] = panelSize[id] === null || panelSize[id] === undefined
      ? 0 : (panelSize[id] + 1) % def.sizes.length;
    applyPanelState(id);
  }
  function setUIHidden(hidden) {
    uiHidden = !!hidden;
    container.classList.toggle('w3d-ui-hidden', uiHidden);
    const toggle = hud.querySelector('.w3d-ui-toggle');
    if (toggle) {
      toggle.textContent = uiHidden ? '👁 Show UI' : '🙈 Hide UI';
      toggle.setAttribute('aria-pressed', String(uiHidden));
      toggle.title = uiHidden ? 'Show all panels (H)' : 'Hide all panels (H)';
    }
    const restore = hud.querySelector('.w3d-ui-restore');
    if (restore) restore.hidden = !uiHidden;
    const menu = hud.querySelector('.w3d-panels-menu');
    if (menu) menu.hidden = true;
    const panelsBtn = hud.querySelector('.w3d-panels-btn');
    if (panelsBtn) panelsBtn.setAttribute('aria-expanded', 'false');
    // Lets the outer page (player.html bar + info sidebar) hide with the HUD.
    window.dispatchEvent(new CustomEvent('worlds3d:ui', { detail: { hidden: uiHidden } }));
  }
  function toggleUI() { setUIHidden(!uiHidden); }
  // One delegated listener for every panel head button; clicking a collapsed
  // head (not on a button) expands the panel again.
  hud.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('[data-w3d-action]') : null;
    if (btn) {
      const id = btn.getAttribute('data-w3d-panel');
      const action = btn.getAttribute('data-w3d-action');
      if (action === 'close') setPanel(id, 'closed');
      else if (action === 'minimise') setPanel(id, panelState[id] === 'collapsed' ? 'open' : 'collapsed');
      else if (action === 'size') cyclePanelSize(id);
      return;
    }
    const head = e.target.closest ? e.target.closest('.w3d-panel-head') : null;
    if (head) {
      const panel = head.closest('.w3d-panel');
      const id = panel && panel.getAttribute('data-panel');
      if (id && panelState[id] === 'collapsed') setPanel(id, 'open');
    }
  });
  const uiToggleBtn = hud.querySelector('.w3d-ui-toggle');
  if (uiToggleBtn) uiToggleBtn.addEventListener('click', toggleUI);
  const uiRestoreBtn = hud.querySelector('.w3d-ui-restore button');
  if (uiRestoreBtn) uiRestoreBtn.addEventListener('click', () => setUIHidden(false));
  const panelsBtn = hud.querySelector('.w3d-panels-btn');
  if (panelsBtn) panelsBtn.addEventListener('click', () => {
    const m = hud.querySelector('.w3d-panels-menu');
    if (!m) return;
    m.hidden = !m.hidden;
    panelsBtn.setAttribute('aria-expanded', String(!m.hidden));
  });
  const panelsMenu = hud.querySelector('.w3d-panels-menu');
  if (panelsMenu) panelsMenu.addEventListener('click', (e) => {
    const b = e.target.closest ? e.target.closest('[data-w3d-menu-panel]') : null;
    if (!b) return;
    const id = b.getAttribute('data-w3d-menu-panel');
    setPanel(id, panelState[id] === 'open' ? 'closed' : 'open');
  });
  renderPanelsMenu();

  // ---------- Renderer + graceful degradation ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    if (!renderer.getContext()) throw new Error('no context');
  } catch (err) {
    const fb = $('.w3d-fallback'); fb.hidden = false;
    toast(NO_WEBGL_MSG, 8000);
    // Safe no-op controller so callers can still call stop()/setWeather()/etc.
    return {
      stop() { hud.remove(); },
      setWeather() {}, setTimeOfDay() {}, teleport() {},
      toggleUI() {}, setUIHidden() {}, isUIHidden() { return false; },
      setPanel() {}, getPanelStates() { return {}; },
      state,
    };
  }
  state.webgl = true;
  // Pixel-ratio cap: 2 on desktop, 1.5 on coarse-pointer (touch) devices.
  // Fill-rate scales with DPR^2, so 1.5 renders 44% fewer pixels than 2
  // on a DPR-2 phone for a small sharpness cost. (Depth-2 perf pass.)
  const prCap = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, prCap));
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'w3d-canvas';
  container.insertBefore(renderer.domElement, hud);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  const clock = new THREE.Clock();
  const loader = new GLTFLoader();

  // ---------- Hosted GLB loading (districts + buildings) ----------
  // Strategy (see ENGINE-NOTE.md §13): districts load EAGERLY at mount —
  // there are few per world and they are the landmarks — while buildings
  // load LAZILY, only once the avatar comes within LAZY_LOAD_RADIUS, because
  // a world can carry dozens of buildings that may never be approached.
  // All loads go through one queue capped at MAX_CONCURRENT_LOADS in flight,
  // so a world with many hosted models cannot stall the first frame or
  // saturate the network. A failed load keeps the procedural form in place
  // (never a blank hole) and is counted in state.modelLoads.failed.
  // Kept at 2 in the Depth-2 perf pass: districts eager (<=8/world) drain in
  // <=4 rounds; the unbounded path was interior props, now queued (below).
  const MAX_CONCURRENT_LOADS = 2;
  const LAZY_LOAD_RADIUS = 120;
  let activeLoads = 0;
  const loadQueue = []; // {url, onLoad, onError}
  const lazyModels = []; // {url, pos:[x,z], groundY, group, hide:[meshes], targetWidth, started, done}
  function pumpLoadQueue() {
    while (activeLoads < MAX_CONCURRENT_LOADS && loadQueue.length) {
      const job = loadQueue.shift();
      activeLoads++;
      loader.load(job.url, (gltf) => {
        activeLoads--; state.modelLoads.loaded++;
        job.onLoad(gltf); pumpLoadQueue();
      }, undefined, (err) => {
        activeLoads--; state.modelLoads.failed++;
        job.onError(err); pumpLoadQueue();
      });
    }
  }
  function enqueueModelLoad(url, onLoad, onError) {
    state.modelLoads.requested++;
    loadQueue.push({ url, onLoad, onError });
    pumpLoadQueue();
  }
  // Fit an unknown-size GLB to a district plate / building footprint: scale
  // the widest horizontal extent to targetWidth, centre it on the holder,
  // and rest its base on the ground (the holder sits at terrain height).
  function placeModelInHolder(gltfScene, holder, targetWidth) {
    const box = new THREE.Box3().setFromObject(gltfScene);
    const size = new THREE.Vector3(); box.getSize(size);
    const s = targetWidth / Math.max(size.x, size.z, 0.001);
    gltfScene.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(gltfScene);
    const c = new THREE.Vector3(); box2.getCenter(c);
    gltfScene.position.set(-c.x, -box2.min.y, -c.z);
    gltfScene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    holder.add(gltfScene);
  }
  function checkLazyModels() {
    for (const entry of lazyModels) {
      if (entry.started) continue;
      if (Math.hypot(entry.pos[0] - avatarPos.x, entry.pos[1] - avatarPos.z) >= LAZY_LOAD_RADIUS) continue;
      entry.started = true;
      const holder = new THREE.Group();
      holder.position.set(entry.pos[0], entry.groundY, entry.pos[1]);
      buildingGroup.add(holder);
      enqueueModelLoad(entry.url, (gltf) => {
        entry.done = true;
        entry.hide.forEach((m) => { m.visible = false; });
        placeModelInHolder(gltf.scene, holder, entry.targetWidth);
      }, (err) => {
        entry.done = true; // procedural building stays; failure is logged, not hidden
        console.warn(`[worlds-3d] building model failed to load, keeping procedural building: ${entry.url}`, err);
      });
    }
  }

  // ---------- Sky: gradient dome + sun + moon + stars, driven by hour ----------
  // The dome shader mixes top/bottom colours by height and adds a horizon
  // band (horizonColor, driven by dusk/night in applyTimeOfDay) so sunsets
  // and night skies read as a glow at the horizon, not a flat gradient.
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x3a7bd5) },
    bottomColor: { value: new THREE.Color(0xcfe8f5) },
    horizonColor: { value: new THREE.Color(0xdfeef8) },
    horizonStrength: { value: 0 },
    offset: { value: 0 }, exponent: { value: 0.7 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 horizonColor; uniform float horizonStrength; uniform float offset; uniform float exponent;
        varying vec3 vP; void main(){ float h=normalize(vP+vec3(0.0,offset,0.0)).y;
        vec3 col=mix(bottomColor,topColor,pow(max(h,0.0),exponent));
        float band=exp(-abs(h)*6.0);
        col=mix(col,horizonColor,band*horizonStrength);
        gl_FragColor=vec4(col,1.0); }`,
    }));
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false }));
  const moonHalo = new THREE.Mesh(new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false, transparent: true, opacity: 0.10 }));
  scene.add(sun); scene.add(moon); scene.add(moonHalo);
  const starGeo = new THREE.BufferGeometry();
  {
    const n = 700, pos = new Float32Array(n * 3), r = mulberry32(99);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2, ph = Math.acos(r() * 0.9);
      pos[i * 3] = 850 * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = 850 * Math.cos(ph) + 40; pos[i * 3 + 2] = 850 * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);
  // Second, dimmer star layer (smaller points, lower base opacity) so the
  // night sky has depth instead of one flat field of identical stars.
  const starGeo2 = new THREE.BufferGeometry();
  {
    const n = 450, pos = new Float32Array(n * 3), r = mulberry32(2024);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2, ph = Math.acos(r() * 0.9);
      pos[i * 3] = 860 * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = 860 * Math.cos(ph) + 40; pos[i * 3 + 2] = 860 * Math.sin(ph) * Math.sin(th);
    }
    starGeo2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }
  const stars2 = new THREE.Points(starGeo2, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars2);
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 500 });
  scene.add(sunLight); scene.add(sunLight.target);
  scene.add(new THREE.HemisphereLight(0xbdd8ff, 0x5a6b4a, 0.9));
  const ambient = new THREE.AmbientLight(0xffffff, 0.25); scene.add(ambient);

  function applyTimeOfDay(hour) {
    state.hour = ((hour % 24) + 24) % 24;
    const t = state.hour / 24, ang = t * Math.PI * 2 - Math.PI / 2; // 6h sunrise, 18h sunset
    const sunH = Math.sin(ang), dayF = THREE.MathUtils.clamp(sunH * 2 + 0.25, 0, 1);
    const duskF = THREE.MathUtils.clamp(1 - Math.abs(sunH) * 3, 0, 1) * (sunH > -0.15 ? 1 : 0);
    const nightF = 1 - dayF;
    _v1.set(Math.cos(ang), Math.sin(ang), 0.25).normalize().multiplyScalar(820);
    sun.position.copy(_v1); sun.lookAt(0, 0, 0);
    moon.position.copy(_v1).multiplyScalar(-1); moon.lookAt(0, 0, 0);
    moonHalo.position.copy(moon.position); moonHalo.lookAt(0, 0, 0);
    const dayTop = SKY_DAY_TOP, dayBot = SKY_DAY_BOT;
    const nightTop = SKY_NIGHT_TOP, nightBot = SKY_NIGHT_BOT;
    const duskTop = SKY_DUSK_TOP, duskBot = SKY_DUSK_BOT;
    skyUniforms.topColor.value.copy(nightTop).lerp(dayTop, dayF).lerp(duskTop, duskF * 0.6);
    skyUniforms.bottomColor.value.copy(nightBot).lerp(dayBot, dayF).lerp(duskBot, duskF * 0.7);
    // Horizon glow: warm band at dusk, faint deep-blue band at night.
    skyUniforms.horizonColor.value.copy(SKY_HORIZON_DAY)
      .lerp(SKY_HORIZON_DUSK, duskF).lerp(SKY_HORIZON_NIGHT, nightF * 0.6);
    skyUniforms.horizonStrength.value = duskF * 0.8 + nightF * 0.35;
    state.dayF = dayF; state.duskF = duskF; state.nightF = nightF;
    // Weather light/ambient are applied HERE every frame (not once in
    // applyWeather): the day cycle rewrites sunLight.intensity on every
    // frame, so a one-shot multiply in applyWeather was overwritten on the
    // very next frame and rain/clouds/mist never actually dimmed the light.
    const wc = state.weatherCur;
    const indoorF = wc ? wc.indoor : 0;
    sunLight.intensity = (0.15 + dayF * 2.1) * (wc ? wc.light : 1);
    sunLight.color.setHex(duskF > 0.4 ? 0xffb36b : 0xfff3d6);
    sunLight.position.copy(_v1).normalize().multiplyScalar(160);
    sun.material.color.setHex(duskF > 0.4 ? 0xff8a3d : 0xffe9a8);
    sun.visible = sunH > -0.12 && indoorF < 0.5;
    moon.visible = sunH < 0.12 && indoorF < 0.5;
    moonHalo.visible = moon.visible;
    moonHalo.material.opacity = 0.10 * (0.4 + 0.6 * nightF); // halo breathes with the night
    // Stars: base night opacity (twinkled in the main loop from state.nightF).
    // Stars dim under cloud/rain/mist (per-preset `stars`) as well as indoors.
    const starBase = THREE.MathUtils.clamp(0.9 - dayF * 1.4, 0, 0.9) * (1 - indoorF) * (wc ? (wc.stars ?? 1) : 1);
    stars.material.opacity = starBase;
    stars2.material.opacity = starBase * 0.55;
    if (indoorF > 0) {
      // Warm steady interior light: dim the sky dome, raise ambient, warm sun.
      skyUniforms.topColor.value.multiplyScalar(1 - indoorF * 0.55);
      skyUniforms.bottomColor.value.multiplyScalar(1 - indoorF * 0.4);
      sunLight.intensity = sunLight.intensity * (1 - indoorF) + 1.5 * indoorF;
      sunLight.color.setHex(0xffd9a0);
      ambient.intensity = 0.25 + (0.55 - 0.25) * indoorF;
    } else {
      ambient.intensity = wc ? wc.ambient : 0.25;
    }
    if (timeInput && timeInput !== document.activeElement) timeInput.value = String(state.hour);
    if (clockElTop) clockElTop.textContent = fmtHour(state.hour);
  }

  // ---------- Weather ----------
  // Presets are data, not branches: every preset is a target for the same
  // lerped state (see state.weatherCur), so switching presets cross-fades
  // fog, light, rain, clouds and wind over ~1 s instead of snapping.
  // fogFar 1200 / fogNear 400 is effectively "no fog" at this world's
  // scale (camera far plane 1200), which lets clear/indoor keep a single
  // persistent THREE.Fog instance instead of toggling scene.fog.
  const WEATHER_PRESETS = {
    'clear':      { fog: 0xcfe8f5, fogNear: 400, fogFar: 1200, light: 1, ambient: 0.25, clouds: 0, rain: 0, wind: 0, indoor: 0, stars: 1 },
    'cloudy':     { fog: 0x9aa8b5, fogNear: 60, fogFar: 320, light: 0.7, ambient: 0.3, clouds: 1, rain: 0, wind: 0.15, indoor: 0, stars: 0.35 },
    'rain':       { fog: 0x7d8a97, fogNear: 60, fogFar: 300, light: 0.45, ambient: 0.32, clouds: 1, rain: 1, wind: 0.5, indoor: 0, stars: 0.15 },
    'dusk':       { fog: 0x4a3a5a, fogNear: 70, fogFar: 380, light: 0.7, ambient: 0.26, clouds: 0.15, rain: 0, wind: 0, indoor: 0, stars: 0.9 },
    'indoor':     { fog: 0xcfe8f5, fogNear: 400, fogFar: 1200, light: 1, ambient: 0.55, clouds: 0, rain: 0, wind: 0, indoor: 1, stars: 0 },
    'mist':       { fog: 0xa8b4bd, fogNear: 25, fogFar: 190, light: 0.55, ambient: 0.34, clouds: 0, rain: 0, wind: 0.05, indoor: 0, stars: 0.3 },
    'golden-hour': { fog: 0xc98a4a, fogNear: 90, fogFar: 460, light: 0.95, ambient: 0.30, clouds: 0.35, rain: 0, wind: 0.05, indoor: 0, stars: 0.9 },
    'breeze':     { fog: 0xcfe8f5, fogNear: 400, fogFar: 1200, light: 1, ambient: 0.25, clouds: 1, rain: 0, wind: 1, indoor: 0, stars: 1 },
  };
  function weatherStateFor(preset) {
    const p = WEATHER_PRESETS[preset] || WEATHER_PRESETS.clear;
    return {
      fogColor: new THREE.Color(p.fog), fogNear: p.fogNear, fogFar: p.fogFar,
      light: p.light, ambient: p.ambient, clouds: p.clouds, rain: p.rain,
      wind: p.wind, indoor: p.indoor, stars: p.stars ?? 1,
    };
  }
  // Current (lerped) and target weather. Initialised to the world's preset
  // so the first frame is already correct; only later switches cross-fade.
  state.weatherCur = weatherStateFor(state.weather);
  state.weatherTarget = weatherStateFor(state.weather);
  const sceneFog = new THREE.Fog(0xcfe8f5, 400, 1200);
  scene.fog = sceneFog;
  function updateWeather(dt) {
    // Exponential approach: ~63% of the way in 0.6 s, ~95% in ~1.8 s.
    const k = Math.min(1, dt * 1.7);
    const cur = state.weatherCur, tgt = state.weatherTarget;
    cur.fogColor.lerp(tgt.fogColor, k);
    cur.fogNear += (tgt.fogNear - cur.fogNear) * k;
    cur.fogFar += (tgt.fogFar - cur.fogFar) * k;
    cur.light += (tgt.light - cur.light) * k;
    cur.ambient += (tgt.ambient - cur.ambient) * k;
    cur.clouds += (tgt.clouds - cur.clouds) * k;
    cur.rain += (tgt.rain - cur.rain) * k;
    cur.wind += (tgt.wind - cur.wind) * k;
    cur.indoor += (tgt.indoor - cur.indoor) * k;
    cur.stars += (tgt.stars - cur.stars) * k; // Depth-2: without this the
    // per-preset star dimming never cross-faded — weatherCur.stars stayed
    // at the mount preset's value forever (caught by test-depth2.mjs).
    sceneFog.color.copy(cur.fogColor);
    sceneFog.near = cur.fogNear; sceneFog.far = cur.fogFar;
    rain.material.opacity = 0.85 * cur.rain;
    rain.visible = cur.rain > 0.02;
    cloudMat.opacity = 0.85 * cur.clouds;
    clouds.visible = cur.clouds > 0.02;
  }

  const rainGeo = new THREE.BufferGeometry();
  const RAIN_N = 1400, rainPos = new Float32Array(RAIN_N * 3), rainVel = new Float32Array(RAIN_N);
  {
    const r = mulberry32(42);
    for (let i = 0; i < RAIN_N; i++) {
      rainPos[i * 3] = (r() - 0.5) * 120; rainPos[i * 3 + 1] = r() * 60; rainPos[i * 3 + 2] = (r() - 0.5) * 120;
      rainVel[i] = 28 + r() * 18;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  }
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9fc8e8, size: 0.55, transparent: true, opacity: 0 }));
  rain.visible = false; rain.frustumCulled = false; scene.add(rain);
  const clouds = new THREE.Group(); scene.add(clouds);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  {
    const r = mulberry32(1234);
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const puffs = 3 + Math.floor(r() * 3);
      for (let j = 0; j < puffs; j++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(6 + r() * 7, 10, 8), cloudMat);
        m.position.set(j * 8 - puffs * 4 + r() * 4, r() * 3, r() * 6 - 3); m.scale.y = 0.45; g.add(m);
      }
      g.position.set((r() - 0.5) * 320, 55 + r() * 30, (r() - 0.5) * 320);
      g.userData.speed = 1.5 + r() * 2.5; clouds.add(g);
    }
  }
  clouds.visible = false;

  function applyWeather(preset) {
    if (!WEATHER_PRESETS[preset]) preset = 'clear';
    state.weather = preset;
    state.weatherTarget = weatherStateFor(preset);
    // Dusk / golden-hour jump the clock once, on the explicit switch —
    // the day cycle then carries on from there.
    if (preset === 'dusk') { state.hour = 18.4; applyTimeOfDay(state.hour); }
    else if (preset === 'golden-hour') { state.hour = 17.6; applyTimeOfDay(state.hour); }
    hud.querySelectorAll('.w3d-weather button').forEach((b) =>
      b.classList.toggle('active', b.dataset.weather === preset));
  }

  // ---------- Terrain ----------
  const terrainGeo = new THREE.PlaneGeometry(terrainDef.size, terrainDef.size, 110, 110);
  terrainGeo.rotateX(-Math.PI / 2);
  {
    const pos = terrainGeo.attributes.position;
    const cGround = new THREE.Color(biome.ground), cGround2 = new THREE.Color(biome.ground2);
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = heightAt(x, z);
      pos.setY(i, y);
      const n = THREE.MathUtils.clamp((y / Math.max(terrainDef.height, 0.01)) * 0.5 + 0.5, 0, 1);
      const c = cGround.clone().lerp(cGround2, n);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();
  }
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  terrain.receiveShadow = true; scene.add(terrain);

  // ---------- Water ----------
  let water = null, waterTex = null;
  if (terrainDef.water) {
    waterTex = waterTexture(); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(8, 8);
    water = new THREE.Mesh(new THREE.PlaneGeometry(terrainDef.size * 0.9, terrainDef.size * 0.9),
      new THREE.MeshPhongMaterial({ map: waterTex, color: 0x3a9ab5, transparent: true, opacity: 0.72, shininess: 120 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.35; water.receiveShadow = true; scene.add(water);
  }

  // ---------- Foliage (instanced) ----------
  const foliageRand = mulberry32(terrainDef.seed * 31 + 5);
  const treeCount = Math.floor(220 * biome.density), grassCount = Math.floor(900 * biome.density);
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.55, 3, 6),
    new THREE.MeshStandardMaterial({ color: biome.trunk, roughness: 1 }), Math.max(treeCount, 1));
  const canopyMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 6.5, 7),
    new THREE.MeshStandardMaterial({ color: biome.tree, roughness: 1 }), Math.max(treeCount, 1));
  const canopy2Mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1.9, 8, 6),
    new THREE.MeshStandardMaterial({ color: biome.tree2, roughness: 1 }), Math.max(treeCount, 1));
  const grassMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 1.1, 4),
    new THREE.MeshStandardMaterial({ color: biome.grass, roughness: 1 }), Math.max(grassCount, 1));
  [trunkMesh, canopyMesh, canopy2Mesh, grassMesh].forEach((m) => { m.castShadow = true; m.instanceMatrix.setUsage(THREE.StaticDrawUsage); scene.add(m); });
  const placedTrees = [];
  for (let i = 0; i < treeCount; i++) {
    const x = (foliageRand() - 0.5) * (terrainDef.size - 30), z = (foliageRand() - 0.5) * (terrainDef.size - 30);
    if (Math.hypot(x, z) < 18) continue; // keep spawn clear
    const s = 0.7 + foliageRand() * 0.9, y = heightAt(x, z);
    _q.setFromAxisAngle(_v3.set(0, 1, 0), foliageRand() * Math.PI * 2);
    _m4.compose(_v1.set(x, y + 1.5 * s, z), _q, _s1.set(s, s, s)); trunkMesh.setMatrixAt(i, _m4);
    _m4.compose(_v1.set(x, y + (3 + 3.2) * s, z), _q, _s1.set(s, s, s)); canopyMesh.setMatrixAt(i, _m4);
    _m4.compose(_v1.set(x, y + 7.2 * s, z), _q, _s1.set(s * 0.8, s * 0.8, s * 0.8)); canopy2Mesh.setMatrixAt(i, _m4);
    placedTrees.push([x, z]);
  }
  for (let i = 0; i < grassCount; i++) {
    const x = (foliageRand() - 0.5) * (terrainDef.size - 20), z = (foliageRand() - 0.5) * (terrainDef.size - 20);
    const s = 0.6 + foliageRand() * 1.1;
    _q.setFromAxisAngle(_v3.set(0, 1, 0), foliageRand() * Math.PI * 2);
    _m4.compose(_v1.set(x, heightAt(x, z) + 0.5 * s, z), _q, _s1.set(s, s, s)); grassMesh.setMatrixAt(i, _m4);
  }
  [trunkMesh, canopyMesh, canopy2Mesh, grassMesh].forEach((m) => { m.instanceMatrix.needsUpdate = true; });

  // ---------- Districts ----------
  const districtGroup = new THREE.Group(); scene.add(districtGroup);
  (def.districts || []).forEach((d) => {
    const [dx, , dz] = d.position || [0, 0, 0];
    const dy = heightAt(dx, dz);
    const plate = new THREE.Mesh(new THREE.CircleGeometry(16, 28),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(d.color || '#888888'), transparent: true, opacity: 0.55, roughness: 1 }));
    plate.rotation.x = -Math.PI / 2; plate.position.set(dx, dy + 0.08, dz); plate.receiveShadow = true;
    districtGroup.add(plate);
    // procedural placeholder structure: arch + plinth (never presented as the real model)
    const ph = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.9 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 8), mat); plinth.position.y = 0.5; ph.add(plinth);
    const pillarGeo = new THREE.BoxGeometry(1, 7, 1);
    const p1 = new THREE.Mesh(pillarGeo, mat); p1.position.set(-3, 4.5, 0); ph.add(p1);
    const p2 = new THREE.Mesh(pillarGeo, mat); p2.position.set(3, 4.5, 0); ph.add(p2);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 1.2), mat); beam.position.y = 8.4; ph.add(beam);
    ph.position.set(dx, dy, dz - 8); ph.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    districtGroup.add(ph);
    const label = makeLabelSprite(d.name); label.position.set(dx, dy + 13, dz); districtGroup.add(label);
    if (isHostedModel(d)) {
      // Hosted model replaces the procedural placeholder in-scene. Eager
      // load (districts are few and are the landmarks) through the shared
      // queue; on failure the procedural arch/plinth stays and the failure
      // is logged, never a blank hole.
      const holder = new THREE.Group();
      holder.position.set(dx, dy, dz);
      districtGroup.add(holder);
      enqueueModelLoad(d.model_ref, (gltf) => {
        districtGroup.remove(ph);
        placeModelInHolder(gltf.scene, holder, 18);
      }, (err) => {
        console.warn(`[worlds-3d] district model failed to load, keeping procedural placeholder: ${d.model_ref}`, err);
      });
    }
    if (isPlaceholderModel(d)) {
      const plaque = makeLabelSprite('model not hosted — placeholder', { font: 30, bg: 'rgba(120,40,20,0.88)' });
      plaque.position.set(dx, dy + 10, dz); plaque.scale.set(13, 2.2, 1); districtGroup.add(plaque);
    }
  });

  // ---------- Buildings + interiors ----------
  const buildingGroup = new THREE.Group(); scene.add(buildingGroup);
  const interiorGroup = new THREE.Group(); interiorGroup.visible = false; scene.add(interiorGroup);
  const buildingBounds = []; // {minX,maxX,minZ,maxZ, def, door:[x,z]}
  const interiors = new Map(); // building id -> {group, exitPos:[x,y,z], room}
  (def.buildings || []).forEach((b) => {
    const [bx, , bz] = b.position || [0, 0, 0];
    const [bw, bh, bd] = b.size || [10, 6, 10];
    const by = heightAt(bx, bz);
    const g = new THREE.Group(); g.position.set(bx, by, bz);
    const tex = buildingTexture(b.color || '#445566');
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    body.position.y = bh / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(bw, bd) * 0.72, 2.4, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 1 }));
    roof.position.y = bh + 1.2; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
    const label = makeLabelSprite(b.name); label.position.y = bh + 5; g.add(label);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 1 }));
    door.position.set(0, 1.6, bd / 2 + 0.15); g.add(door);
    buildingGroup.add(g);
    if (isHostedModel(b)) {
      // Hosted building model, loaded LAZILY (see checkLazyModels): the load
      // only starts when the avatar comes within LAZY_LOAD_RADIUS. On
      // success the procedural body/roof/door hide and the GLB takes their
      // place; the name label stays, and collision keeps using the
      // procedural AABB in buildingBounds. No current world ships a building
      // model_ref (186 buildings, all procedural) — this path is ready for
      // when one is added.
      lazyModels.push({
        url: b.model_ref, pos: [bx, bz], groundY: by,
        hide: [body, roof, door], targetWidth: Math.max(bw, bd),
        started: false, done: false,
      });
    }
    buildingBounds.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2, def: b, door: [bx, bz + bd / 2 + 1.5] });
    // interior room (game space), built far below the terrain so it never overlaps the exterior
    if (b.interior && b.interior.rooms && b.interior.rooms.length) {
      const room = b.interior.rooms[0];
      const [rw, rh, rd] = room.size || [12, 5, 10];
      const ig = new THREE.Group(); ig.position.set(0, -120, 0);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.4, rd),
        new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 1 })); floor.position.y = -0.2; ig.add(floor);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 1, side: THREE.BackSide });
      const roomBox = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), wallMat); roomBox.position.y = rh / 2; ig.add(roomBox);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd),
        new THREE.MeshStandardMaterial({ color: 0xf5efe0 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = rh; ig.add(ceil);
      const roomLabel = makeLabelSprite((b.interior.name || b.name + ' Interior') + ' — game space', { font: 32 });
      roomLabel.position.set(0, rh - 1, -rd / 2 + 0.6); roomLabel.scale.set(11, 2, 1); ig.add(roomLabel);
      const exitPad = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20),
        new THREE.MeshStandardMaterial({ color: 0x35d0ff, emissive: 0x1a6a80 }));
      exitPad.rotation.x = -Math.PI / 2; exitPad.position.set(0, 0.05, rd / 2 - 1.5); ig.add(exitPad);
      const exitLabel = makeLabelSprite('EXIT → outside', { font: 30, bg: 'rgba(20,90,110,0.9)' });
      exitLabel.position.set(0, 2.2, rd / 2 - 1.5); exitLabel.scale.set(7, 1.6, 1); ig.add(exitLabel);
      (room.props || []).forEach((prop) => {
        const [px, , pz] = prop.position || [0, 0, 0];
        const fallback = () => {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2),
            new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 1 }));
          crate.position.set(px, 0.6, pz); crate.castShadow = true; ig.add(crate);
        };
        if (prop.model) {
          // Through the shared queue: a direct loader.load here bypassed
          // the MAX_CONCURRENT_LOADS cap, so a world with many interior
          // props could start them all at once. The fallback is the same
          // crate on failure; the load now also counts in
          // state.modelLoads like every other GLB load. (Depth-2.)
          enqueueModelLoad(prop.model, (gltf) => {
            gltf.scene.position.set(px, 0, pz); gltf.scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
            ig.add(gltf.scene);
          }, () => fallback());
        } else fallback();
      });
      ig.add(new THREE.PointLight(0xffe9c0, 60, 30)); ig.children[ig.children.length - 1].position.set(0, rh - 0.5, 0);
      interiorGroup.add(ig);
      interiors.set(b.id, { group: ig, roomSize: [rw, rh, rd], exitWorld: [bx, by, bz + bd / 2 + 3] });
    }
  });

  // ---------- Collectibles ----------
  const collectibleGroup = new THREE.Group(); scene.add(collectibleGroup);
  const collectibles = [];
  (def.collectibles || []).forEach((c) => {
    const style = COLLECTIBLE_STYLE[c.kind] || COLLECTIBLE_STYLE.spark;
    const geo = style.geo === 'icosa' ? new THREE.IcosahedronGeometry(0.7, 0)
      : style.geo === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.OctahedronGeometry(0.8, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: style.color, emissive: style.color, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.4 }));
    const [cx, cy, cz] = c.position || [0, 1, 0];
    mesh.position.set(cx, (cy || 1) + heightAt(cx, cz) * 0, cz);
    mesh.position.y = heightAt(cx, cz) + 1.6;
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 24),
      new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = heightAt(cx, cz) + 0.12; collectibleGroup.add(halo);
    collectibleGroup.add(mesh);
    collectibles.push({ def: c, mesh, halo, taken: false, baseY: mesh.position.y });
  });

  // ---------- NPCs ----------
  const npcGroup = new THREE.Group(); scene.add(npcGroup);
  const npcs = [];
  (def.npcs || []).forEach((n) => {
    const [nx, , nz] = n.position || [0, 0, 0];
    const g = new THREE.Group(); g.position.set(nx, heightAt(nx, nz), nz);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a5fd0, roughness: 0.8 }));
    body.position.y = 1.1; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8c39a, roughness: 0.8 })); head.position.y = 2.35; g.add(head);
    const label = makeLabelSprite(n.name + (n.role ? ' · ' + n.role : ''), { font: 34 });
    label.position.y = 3.4; label.scale.set(9, 1.8, 1); g.add(label);
    npcGroup.add(g);
    npcs.push({ def: n, group: g, pos: [nx, nz] });
  });

  // ---------- Avatar + companion ----------
  function makeCapsuleFigure(color, name) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.0, 4, 10),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    body.position.y = 1.05; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8c39a, roughness: 0.8 })); head.position.y = 2.2; g.add(head);
    if (name) { const l = makeLabelSprite(name, { font: 34 }); l.position.y = 3.1; l.scale.set(7, 1.5, 1); g.add(l); }
    return g;
  }
  const avatar = makeCapsuleFigure(0x2f6fd0, 'You');
  scene.add(avatar);
  const spawn = def.spawn ? def.spawn.slice() : [0, 2, 24];
  const avatarPos = new THREE.Vector3(spawn[0], spawn[1], spawn[2]);
  let velY = 0, grounded = true;
  avatar.position.copy(avatarPos);

  const companions = [];
  (def.agent_companions || []).forEach((c) => {
    const fig = makeCapsuleFigure(new THREE.Color(c.color || '#e8c85a').getHex(), c.name);
    fig.position.set(avatarPos.x + 3, heightAt(avatarPos.x + 3, avatarPos.z + 3), avatarPos.z + 3);
    scene.add(fig);
    companions.push({ def: c, group: fig, greeted: false });
  });

  // ---------- Camera / input ----------
  let yaw = Math.PI, pitch = 0.32, camDist = 9;
  const keys = {};
  const joy = { active: false, x: 0, y: 0 };
  let lookDrag = null;
  function updateCamera(dt) {
    const cx = avatarPos.x - Math.sin(yaw) * Math.cos(pitch) * camDist;
    const cz = avatarPos.z - Math.cos(yaw) * Math.cos(pitch) * camDist;
    const cy = avatarPos.y + 2 + Math.sin(pitch) * camDist;
    camera.position.set(cx, Math.max(cy, heightAt(cx, cz) + 0.6), cz);
    camera.lookAt(avatarPos.x, avatarPos.y + 1.8, avatarPos.z);
  }
  function groundY(x, z) {
    if (state.insideBuilding) return -120; // interior floor level
    return heightAt(x, z);
  }
  function collideBuildings(nx, nz) {
    if (state.insideBuilding) {
      const it = interiors.get(state.insideBuilding);
      if (it) {
        const [rw, , rd] = it.roomSize;
        nx = THREE.MathUtils.clamp(nx, -rw / 2 + 0.8, rw / 2 - 0.8);
        nz = THREE.MathUtils.clamp(nz, -rd / 2 + 0.8, rd / 2 - 0.8);
      }
      return [nx, nz];
    }
    for (const b of buildingBounds) {
      if (nx > b.minX - 0.6 && nx < b.maxX + 0.6 && nz > b.minZ - 0.6 && nz < b.maxZ + 0.6) {
        const pushL = nx - (b.minX - 0.6), pushR = (b.maxX + 0.6) - nx;
        const pushB = nz - (b.minZ - 0.6), pushF = (b.maxZ + 0.6) - nz;
        const m = Math.min(pushL, pushR, pushB, pushF);
        if (m === pushL) nx = b.minX - 0.6; else if (m === pushR) nx = b.maxX + 0.6;
        else if (m === pushB) nz = b.minZ - 0.6; else nz = b.maxZ + 0.6;
      }
    }
    return [nx, nz];
  }

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); tryJump(); }
    if (e.code === 'KeyE') interact();
    // H hides / restores every panel for a clear view (not while typing in a
    // field — the time slider is an input, so H there must not hide the UI).
    if (e.code === 'KeyH' && !isTypingTarget(e.target)) { e.preventDefault(); toggleUI(); }
    if (e.code === 'Escape') {
      const dlg = $('.w3d-dialog');
      if (dlg && !dlg.hidden) closeDialog();
      else if (uiHidden) setUIHidden(false);
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.clientX > window.innerWidth * 0.45) lookDrag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', (e) => {
    if (!lookDrag) return;
    yaw -= (e.clientX - lookDrag.x) * 0.005;
    pitch = THREE.MathUtils.clamp(pitch + (e.clientY - lookDrag.y) * 0.004, -0.1, 1.1);
    lookDrag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', () => { lookDrag = null; });
  // touch joystick
  const joyEl = $('.w3d-joy'), knob = $('.w3d-joy-knob');
  let joyPointer = null;
  joyEl.addEventListener('pointerdown', (e) => { joyPointer = e.pointerId; joyEl.setPointerCapture(e.pointerId); moveJoy(e); });
  joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyPointer) moveJoy(e); });
  const endJoy = () => { joyPointer = null; joy.active = false; joy.x = joy.y = 0; knob.style.transform = 'translate(-50%,-50%)'; };
  joyEl.addEventListener('pointerup', endJoy); joyEl.addEventListener('pointercancel', endJoy);
  function moveJoy(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    joy.active = true; joy.x = dx; joy.y = dy;
    knob.style.transform = `translate(calc(-50% + ${dx * 28}px), calc(-50% + ${dy * 28}px))`;
  }
  $('.w3d-btn-jump').addEventListener('click', tryJump);
  $('.w3d-btn-interact').addEventListener('click', interact);
  $('.w3d-time input').addEventListener('input', (e) => applyTimeOfDay(parseFloat(e.target.value)));
  hud.querySelectorAll('.w3d-weather button').forEach((b) =>
    b.addEventListener('click', () => applyWeather(b.dataset.weather)));

  function tryJump() { if (grounded) { velY = 8.5; grounded = false; } }
  function nearestNPC() {
    // No outdoor NPC is talkable from inside a building: the room's
    // local coords can coincide with an outdoor NPC's world coords, and
    // the 2D distance check would let that NPC hijack E presses meant
    // for the EXIT pad (hub capsule-guide at (-5.4,-2.2) did exactly
    // this). There are no interior NPCs in any world. (Depth-2 debug.)
    if (state.insideBuilding) return null;
    let best = null, bd = 4.5;
    for (const n of npcs) { const d = Math.hypot(n.pos[0] - avatarPos.x, n.pos[1] - avatarPos.z); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  function interact() {
    // Inside a building, Interact is the EXIT pad only. The exit trigger
    // is 1.2 u, matching the pad's 1.4 u visual radius: the old 2.2 u
    // radius covered the entry spawn point 1.5 u from the pad, so one
    // stray E press right after entering teleported the player straight
    // back out. nearestNPC() already returns null indoors, so no outdoor
    // NPC can hijack the press. (Depth-2 debug.)
    if (state.insideBuilding) {
      const it = interiors.get(state.insideBuilding);
      if (it && Math.hypot(avatarPos.x - 0, avatarPos.z - (it.roomSize[2] / 2 - 1.5)) < 1.2) { exitInterior(); return; }
      return;
    }
    const npc = nearestNPC();
    const near = state.nearBuilding;
    // A door-side NPC stands 1.5 u in front of its door, on the approach
    // axis — with NPC-first priority the building could never be entered,
    // because the door's 3 u zone sits entirely inside the NPC's 4.5 u
    // talk zone (31 door-side NPCs blocked entry). Closest target wins:
    // walk right up to the door to enter, stand back a step to talk.
    if (npc && near) {
      const doorD = Math.hypot(near.door[0] - avatarPos.x, near.door[1] - avatarPos.z);
      const npcD = Math.hypot(npc.pos[0] - avatarPos.x, npc.pos[1] - avatarPos.z);
      if (doorD < npcD) {
        if (interiors.has(near.def.id)) { enterInterior(near.def.id); return; }
        toast(`${near.def.name} — interior not defined for this building.`);
        return;
      }
    }
    if (npc) { openDialogue(npc); return; }
    if (near && interiors.has(near.def.id)) { enterInterior(near.def.id); return; }
    if (near) toast(`${near.def.name} — interior not defined for this building.`);
  }
  function enterInterior(id) {
    const it = interiors.get(id); if (!it) return;
    state.insideBuilding = id;
    interiorGroup.visible = true;
    avatarPos.set(0, -120, it.roomSize[2] / 2 - 3);
    avatar.position.copy(avatarPos);
    toast(`${(def.buildings.find((b) => b.id === id) || {}).name || id} interior — game space. Press Interact on the blue EXIT pad to leave.`);
  }
  function exitInterior() {
    const it = interiors.get(state.insideBuilding); if (!it) return;
    state.insideBuilding = null;
    interiorGroup.visible = false;
    avatarPos.set(it.exitWorld[0], it.exitWorld[1] + 0.5, it.exitWorld[2]);
    avatar.position.copy(avatarPos); velY = 0; grounded = true;
    toast('Back outside.');
  }

  // ---------- Dialogue + quests ----------
  const questsById = {}; (def.quests || []).forEach((q) => { questsById[q.id] = q; state.questProgress[q.id] = 0; });
  // Place-step targets: every building/district name maps to a ground
  // circle (building: centre + half-diagonal, min 6 u; district: plate
  // radius 18 u). Buildings win on a name clash (zones appear as both a
  // district plate and a building at the same spot). 'place' quest steps
  // resolve against these real targets — nothing invented.
  const placeTargets = [];
  buildingBounds.forEach((b) => {
    const w = (b.maxX - b.minX) / 2, dd = (b.maxZ - b.minZ) / 2;
    placeTargets.push({ name: b.def.name, x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, r: Math.max(6, Math.hypot(w, dd)) });
  });
  (def.districts || []).forEach((d) => {
    if (placeTargets.some((p) => p.name === d.name)) return;
    const [dx, , dz] = d.position || [0, 0, 0];
    placeTargets.push({ name: d.name, x: dx, z: dz, r: 18 });
  });
  function checkPlaceSteps() {
    if (state.insideBuilding) return;
    for (const qid of Object.keys(state.questsAccepted)) {
      if (state.questsComplete[qid]) continue;
      const q = questsById[qid], step = q.steps[state.questProgress[qid]];
      if (!step || step.kind !== 'place') continue;
      const tgt = placeTargets.find((p) => p.name === step.target);
      if (tgt && Math.hypot(tgt.x - avatarPos.x, tgt.z - avatarPos.z) < tgt.r) {
        advanceQuestStep('place', step.target);
      }
    }
  }
  let dialogNPC = null, dialogLine = 0;
  function closeDialog() {
    const d = $('.w3d-dialog');
    if (d) d.hidden = true;
    dialogNPC = null;
    // A closed dialogue is not "closed" as a panel — talking to an NPC again
    // reopens it — so reset its panel state instead of leaving it collapsed.
    panelState.dialog = 'open';
    const el = panelEls.dialog;
    if (el) el.classList.remove('w3d-collapsed');
  }
  function openDialogue(npc) {
    // Talking is deliberate: if the UI was hidden for a clear view, bring it
    // back so the conversation is actually visible.
    if (uiHidden) setUIHidden(false);
    panelState.dialog = 'open';
    applyPanelState('dialog');
    dialogNPC = npc; dialogLine = 0;
    $('.w3d-dialog-name').textContent = npc.def.name + (npc.def.role ? ' — ' + npc.def.role : '');
    $('.w3d-dialog-line').textContent = (npc.def.dialogue && npc.def.dialogue[0]) || '…';
    const qb = $('.w3d-dialog-quest');
    const qid = npc.def.quest;
    qb.hidden = !(qid && questsById[qid] && !state.questsAccepted[qid]);
    qb.textContent = qid && questsById[qid] ? `Accept quest: ${questsById[qid].title}` : 'Accept quest';
    $('.w3d-dialog').hidden = false;
    // Talking to an NPC completes any accepted quest step that asks for it.
    // (Before this, 'npc' steps never advanced: advanceQuestStep was only
    // ever called for 'collectible' and 'position' steps, so no quest whose
    // first step was "talk to X" — i.e. every quest — could ever complete.)
    advanceQuestStep('npc', npc.def.id);
  }
  $('.w3d-dialog-next').addEventListener('click', () => {
    if (!dialogNPC) return;
    const lines = dialogNPC.def.dialogue || [];
    dialogLine = (dialogLine + 1) % Math.max(lines.length, 1);
    $('.w3d-dialog-line').textContent = lines[dialogLine] || '…';
  });
  $('.w3d-dialog-close').addEventListener('click', closeDialog);
  $('.w3d-dialog-quest').addEventListener('click', () => {
    if (!dialogNPC || !dialogNPC.def.quest) return;
    acceptQuest(dialogNPC.def.quest);
    $('.w3d-dialog-quest').hidden = true;
    // The quest's first step is usually "talk to this NPC" — the player is
    // already talking to them, so that step completes on accept.
    advanceQuestStep('npc', dialogNPC.def.id);
  });
  function acceptQuest(qid) {
    const q = questsById[qid]; if (!q || state.questsAccepted[qid]) return;
    state.questsAccepted[qid] = true; state.questProgress[qid] = 0;
    renderQuestTracker(); toast(`Quest accepted: ${q.title}`);
  }
  function advanceQuestStep(kind, targetId) {
    for (const qid of Object.keys(state.questsAccepted)) {
      if (state.questsComplete[qid]) continue;
      const q = questsById[qid]; const step = q.steps[state.questProgress[qid]];
      if (!step || step.kind !== kind || step.target !== targetId) continue;
      state.questProgress[qid]++;
      if (state.questProgress[qid] >= q.steps.length) {
        state.questsComplete[qid] = true;
        toast(`Quest complete: ${q.title} — Reward: ${q.reward || '—'}`, 6000);
      } else toast(`Quest step done: ${step.text}`);
      renderQuestTracker();
    }
  }
  function renderQuestTracker() {
    const body = $('.w3d-quest-body');
    const active = Object.keys(state.questsAccepted).filter((id) => !state.questsComplete[id]);
    const done = Object.keys(state.questsComplete);
    if (!active.length && !done.length) { body.textContent = 'No quest accepted yet.'; return; }
    body.innerHTML = active.map((id) => {
      const q = questsById[id], step = q.steps[state.questProgress[id]];
      return `<div class="w3d-quest-row"><strong>${escapeHtml(q.title)}</strong><br>` +
        `<span>${step ? escapeHtml(step.text) : '…'}</span><br>` +
        `<span class="w3d-quest-prog">${state.questProgress[id]} / ${q.steps.length} steps</span></div>`;
    }).join('') + done.map((id) => `<div class="w3d-quest-row w3d-quest-done">✓ ${escapeHtml(questsById[id].title)} — complete (${escapeHtml(questsById[id].reward || '')})</div>`).join('');
  }
  function renderCollectCounter() {
    $('.w3d-collect').textContent = `✦ ${state.collected.length} collected`;
  }

  // ---------- Main loop ----------
  let raf = 0; state.running = true;
  let lazyTimer = 0; // throttle for the lazy building-model scan
  let lazyScanDone = lazyModels.length === 0; // true once every lazy model has started
  function animate() {
    if (!state.running) return;
    raf = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // movement
    let fwd = 0, strafe = 0;
    if (keys.KeyW || keys.ArrowUp) fwd += 1;
    if (keys.KeyS || keys.ArrowDown) fwd -= 1;
    if (keys.KeyA || keys.ArrowLeft) strafe -= 1;
    if (keys.KeyD || keys.ArrowRight) strafe += 1;
    if (joy.active) { fwd -= joy.y; strafe += joy.x; }
    const moving = fwd !== 0 || strafe !== 0;
    if (moving) {
      const run = keys.ShiftLeft || keys.ShiftRight;
      const speed = (run ? 11 : 5.5) * (state.insideBuilding ? 0.7 : 1);
      const len = Math.hypot(fwd, strafe); fwd /= len; strafe /= len;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      let nx = avatarPos.x + (-sin * fwd + cos * strafe) * speed * dt;
      let nz = avatarPos.z + (-cos * fwd - sin * strafe) * speed * dt;
      [nx, nz] = collideBuildings(nx, nz);
      avatarPos.x = nx; avatarPos.z = nz;
      avatar.rotation.y = Math.atan2(-sin * fwd + cos * strafe, -cos * fwd - sin * strafe);
    }
    // gravity / jump
    const gy = groundY(avatarPos.x, avatarPos.z);
    velY -= 22 * dt; avatarPos.y += velY * dt;
    if (avatarPos.y <= gy) { avatarPos.y = gy; velY = 0; grounded = true; }
    avatar.position.copy(avatarPos);
    // walk bob
    avatar.children[0].position.y = 1.05 + (moving && grounded ? Math.abs(Math.sin(t * 10)) * 0.08 : 0);

    // day cycle
    if (state.dayCycle && !(timeInput === document.activeElement)) {
      applyTimeOfDay(state.hour + dt * 0.15); // ~4 min per full day at 60fps; slider overrides
    } else applyTimeOfDay(state.hour);

    // weather animation: cross-fade toward the preset target, then animate.
    updateWeather(dt);
    if (rain.visible) {
      // Rain lives in a 120x120x60 box centred on the avatar (wrapped, not
      // re-randomised) so it never rains at the origin while the player
      // walks away; wind slants the fall. Drops fall 28–46 u/s, respawn at
      // 55–60 u, and the box follows the avatar exactly.
      // Direct Float32Array access (Depth-2): the old per-drop getX/getY/
      // getZ/setX/setY/setZ calls were 6 attribute lookups per drop per
      // frame for 1400 drops; the math below is identical.
      const pos = rainGeo.attributes.position;
      const arr = pos.array;
      const windX = state.weatherCur.wind * 14; // u/s of horizontal slant
      for (let i = 0; i < RAIN_N; i++) {
        const i3 = i * 3;
        let y = arr[i3 + 1] - rainVel[i] * dt;
        let x = arr[i3] + windX * dt;
        if (y < 0) {
          y = 55 + Math.random() * 5;
          x = avatarPos.x + (Math.random() - 0.5) * 120;
          arr[i3 + 2] = avatarPos.z + (Math.random() - 0.5) * 120;
        }
        // Wrap x/z into the box around the avatar (modulo keeps it seamless).
        const dx = (((x - avatarPos.x + 60) % 120) + 120) % 120 - 60;
        const dz = (((arr[i3 + 2] - avatarPos.z + 60) % 120) + 120) % 120 - 60;
        arr[i3] = avatarPos.x + dx; arr[i3 + 2] = avatarPos.z + dz;
        arr[i3 + 1] = y;
      }
      pos.needsUpdate = true;
    }
    if (clouds.visible) clouds.children.forEach((c) => {
      // Drift speed scales with the preset wind (breeze drifts fastest).
      c.position.x += c.userData.speed * (1 + state.weatherCur.wind * 2) * dt;
      if (c.position.x > 200) c.position.x = -200;
    });
    // Star twinkle at night: gentle ±12% breathing on both layers.
    if (state.nightF > 0.05) {
      const tw = 1 + Math.sin(t * 1.7) * 0.12;
      const base = THREE.MathUtils.clamp(0.9 - state.dayF * 1.4, 0, 0.9) * (1 - state.weatherCur.indoor) * (state.weatherCur.stars ?? 1) * tw;
      stars.material.opacity = base;
      stars2.material.opacity = base * 0.55;
    }
    if (water) { waterTex.offset.x = (t * 0.02) % 1; waterTex.offset.y = (t * 0.013) % 1; water.material.opacity = 0.66 + Math.sin(t * 0.8) * 0.06; }

    // collectibles: spin + bob, pickup on proximity
    for (const c of collectibles) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 1.6; c.mesh.rotation.x += dt * 0.4;
      c.mesh.position.y = c.baseY + Math.sin(t * 2 + c.mesh.position.x) * 0.25;
      if (Math.hypot(c.mesh.position.x - avatarPos.x, c.mesh.position.z - avatarPos.z) < 1.8 &&
        Math.abs(c.mesh.position.y - avatarPos.y) < 3.5) {
        c.taken = true; c.mesh.visible = false; c.halo.visible = false;
        state.collected.push(c.def.id);
        renderCollectCounter(); toast(`Collected: ${c.def.name || c.def.id}`);
        advanceQuestStep('collectible', c.def.id);
      }
    }
    // NPC proximity + quest talk step
    const near = nearestNPC();
    if (near) {
      // The nearest NPC turns to face the player. (The placeholder
      // avatars are radially symmetric capsules with camera-facing
      // sprite labels, so this changes nothing visible today — it keeps
      // the behaviour correct for future asymmetric NPC models.)
      near.group.lookAt(avatarPos.x, near.group.position.y, avatarPos.z);
    }
    if (near && near !== state.nearNPC) {
      state.nearNPC = near;
      toast(`${near.def.name}: press E / Interact to talk.`);
    } else if (!near) state.nearNPC = null;
    // door proximity
    state.nearBuilding = null;
    if (!state.insideBuilding) {
      for (const b of buildingBounds) {
        if (Math.hypot(b.door[0] - avatarPos.x, b.door[1] - avatarPos.z) < 3) { state.nearBuilding = b; break; }
      }
      if (state.nearBuilding) {
        // show a one-shot hint via title attr on canvas (cheap, no extra DOM churn)
        renderer.domElement.title = `Press E / Interact to enter ${state.nearBuilding.def.name}`;
      }
    }
    // companion follow + greeting
    for (const comp of companions) {
      _v2.set(avatarPos.x + 3, 0, avatarPos.z + 3);
      const targetY = state.insideBuilding ? -120 : heightAt(_v2.x, _v2.z);
      comp.group.position.x += (_v2.x - comp.group.position.x) * Math.min(1, dt * 2);
      comp.group.position.z += (_v2.z - comp.group.position.z) * Math.min(1, dt * 2);
      comp.group.position.y += (targetY - comp.group.position.y) * Math.min(1, dt * 2);
      comp.group.lookAt(avatarPos.x, comp.group.position.y, avatarPos.z);
      const d = Math.hypot(comp.group.position.x - avatarPos.x, comp.group.position.z - avatarPos.z);
      if (!comp.greeted && d < 6) {
        comp.greeted = true; state.companionGreeted = true;
        const line = comp.def.greeting
          ? `${comp.def.name}: ${comp.def.greeting}`
          : `${comp.def.name} (${comp.def.role || 'companion'}): Hello, traveller — I can guide you around this world.`;
        toast(line);
      }
    }
    // compass strip
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const deg = ((Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 180 / Math.PI) + 360) % 360;
    const compass = $('.w3d-compass');
    if (compass) compass.textContent = '◂ ' + dirs[Math.round(deg / 45) % 8] + ' ▸';
    // position-type quest steps
    for (const qid of Object.keys(state.questsAccepted)) {
      if (state.questsComplete[qid]) continue;
      const q = questsById[qid], step = q.steps[state.questProgress[qid]];
      if (step && step.kind === 'position' && step.target && Array.isArray(step.target)) {
        if (Math.hypot(step.target[0] - avatarPos.x, step.target[2] - avatarPos.z) < 4) advanceQuestStep('position', step.target);
      }
    }

    // lazy GLB loading for hosted buildings + place-step quest checks
    // (throttled: one scan per 0.5 s — neither needs per-frame precision,
    // and the scan is O(buildings) in the Holodeck's 122-building world).
    // Once every lazy model has started, the scan stops entirely.
    lazyTimer += dt;
    if (lazyTimer >= 0.5) {
      lazyTimer = 0;
      if (!lazyScanDone) {
        checkLazyModels();
        if (lazyModels.every((e) => e.started)) lazyScanDone = true;
      }
      checkPlaceSteps();
    }

    updateCamera(dt);
    renderer.render(scene, camera);
  }

  function onResize() {
    const w = container.clientWidth || 800, h = container.clientHeight || 600;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  onResize();

  applyWeather(state.weather);
  applyTimeOfDay(state.hour);
  renderQuestTracker(); renderCollectCounter();
  animate();

  const controller = {
    stop() {
      state.running = false; cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose(); renderer.domElement.remove(); hud.remove();
    },
    setWeather(preset) { if (['clear', 'cloudy', 'rain', 'dusk', 'indoor', 'mist', 'golden-hour', 'breeze'].includes(preset)) applyWeather(preset); },
    setTimeOfDay(hour) { applyTimeOfDay(hour); },
    toggleUI, setUIHidden,
    isUIHidden() { return uiHidden; },
    setPanel, getPanelStates() { return Object.assign({}, panelState); },
    teleport(pos) {
      if (!Array.isArray(pos) || pos.length < 3) return;
      if (state.insideBuilding) { state.insideBuilding = null; interiorGroup.visible = false; }
      avatarPos.set(pos[0], pos[1], pos[2]); avatar.position.copy(avatarPos); velY = 0;
    },
    state,
  };
  return controller;
}
