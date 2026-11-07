// worlds-3d engine — plain Three.js r160, no backend, no runtime CDN.
// Vendored Three.js source: three@0.160.0 (unpkg, downloaded once at build time).
// Everything below runs from file:// or GitHub Pages with relative paths only.
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
  const tex = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(6, 14, w - 12, h - 28, 18); ctx.fill();
    ctx.fillStyle = fg; ctx.font = `bold ${font}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text.length > 26 ? text.slice(0, 25) + '…' : text, w / 2, h / 2);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat); s.scale.set(10, 2.5, 1); return s;
}
function buildingTexture(baseColor) {
  return canvasTexture(256, 256, (ctx, w, h) => {
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
}
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
  };

  // ---------- HUD (built first so the no-WebGL fallback can reuse it) ----------
  container.classList.add('w3d-container');
  const hud = document.createElement('div'); hud.className = 'w3d-hud'; container.appendChild(hud);
  hud.innerHTML = `
    <div class="w3d-topbar">
      <div class="w3d-title"><strong></strong><span class="w3d-badge"></span></div>
      <div class="w3d-label">Web 3D interpretation — not on RP1</div>
    </div>
    <div class="w3d-quest"><h3>Quests</h3><div class="w3d-quest-body">No quest accepted yet.</div></div>
    <div class="w3d-counters"><span class="w3d-collect">✦ 0 collected</span><span class="w3d-compass">N</span></div>
    <div class="w3d-controls">
      <div class="w3d-weather" role="group" aria-label="Weather">
        <button data-weather="clear">☀ Clear</button><button data-weather="cloudy">☁ Cloudy</button>
        <button data-weather="rain">🌧 Rain</button><button data-weather="dusk">🌆 Dusk</button>
      </div>
      <label class="w3d-time">🕐 <input type="range" min="0" max="24" step="0.25" value="${state.hour}" aria-label="Time of day"> <span class="w3d-clock"></span></label>
    </div>
    <div class="w3d-info"><h3>About this place</h3><div class="w3d-info-body"></div></div>
    <div class="w3d-dialog" hidden><h3 class="w3d-dialog-name"></h3><p class="w3d-dialog-line"></p>
      <div class="w3d-dialog-btns"><button class="w3d-dialog-next">Next ▸</button>
      <button class="w3d-dialog-quest" hidden>Accept quest</button>
      <button class="w3d-dialog-close">Close</button></div></div>
    <div class="w3d-toast" hidden></div>
    <div class="w3d-touch"><div class="w3d-joy"><div class="w3d-joy-knob"></div></div>
      <div class="w3d-touch-btns"><button class="w3d-btn-jump">Jump</button><button class="w3d-btn-interact">Interact</button></div></div>
    <div class="w3d-fallback" hidden><p>${NO_WEBGL_MSG}</p><p class="w3d-fallback-sub">This world is a WebGL experience. Try a recent desktop or mobile browser with hardware acceleration enabled.</p></div>`;
  const $ = (sel) => hud.querySelector(sel);
  $('.w3d-title strong').textContent = def.name || 'Untitled World';
  const badge = $('.w3d-badge'); badge.textContent = (def.status || 'demo').toUpperCase();
  badge.classList.add('w3d-badge-' + (def.status || 'demo'));
  const infoBody = $('.w3d-info-body');
  const missing = def.missing_models || [];
  infoBody.innerHTML = (def.districts || []).map((d) => {
    const hosted = d.model_status !== 'not-hosted';
    return `<div class="w3d-district-row"><strong>${escapeHtml(d.name)}</strong> — ` +
      (hosted ? `model: ${escapeHtml(d.model_ref || '—')}` : `<em>model not hosted — placeholder</em>`) + `</div>`;
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
      state,
    };
  }
  state.webgl = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'w3d-canvas';
  container.insertBefore(renderer.domElement, hud);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  const clock = new THREE.Clock();
  const loader = new GLTFLoader();

  // ---------- Sky: gradient dome + sun + moon + stars, driven by hour ----------
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x3a7bd5) },
    bottomColor: { value: new THREE.Color(0xcfe8f5) },
    offset: { value: 0 }, exponent: { value: 0.7 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent;
        varying vec3 vP; void main(){ float h=normalize(vP+vec3(0.0,offset,0.0)).y;
        gl_FragColor=vec4(mix(bottomColor,topColor,pow(max(h,0.0),exponent)),1.0); }`,
    }));
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 32),
    new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false }));
  scene.add(sun); scene.add(moon);
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
    _v1.set(Math.cos(ang), Math.sin(ang), 0.25).normalize().multiplyScalar(820);
    sun.position.copy(_v1); sun.lookAt(0, 0, 0);
    moon.position.copy(_v1).multiplyScalar(-1); moon.lookAt(0, 0, 0);
    const dayTop = new THREE.Color(0x2f6fd0), dayBot = new THREE.Color(0xcfe8f5);
    const nightTop = new THREE.Color(0x050914), nightBot = new THREE.Color(0x0e1a2e);
    const duskTop = new THREE.Color(0x5a3a6b), duskBot = new THREE.Color(0xff9a5a);
    skyUniforms.topColor.value.copy(nightTop).lerp(dayTop, dayF).lerp(duskTop, duskF * 0.6);
    skyUniforms.bottomColor.value.copy(nightBot).lerp(dayBot, dayF).lerp(duskBot, duskF * 0.7);
    sunLight.intensity = 0.15 + dayF * 2.1;
    sunLight.color.setHex(duskF > 0.4 ? 0xffb36b : 0xfff3d6);
    sunLight.position.copy(_v1).normalize().multiplyScalar(160);
    sun.material.color.setHex(duskF > 0.4 ? 0xff8a3d : 0xffe9a8);
    sun.visible = sunH > -0.12; moon.visible = sunH < 0.12;
    stars.material.opacity = THREE.MathUtils.clamp(0.9 - dayF * 1.4, 0, 0.9);
    const slider = $('.w3d-time input');
    if (slider && slider !== document.activeElement) slider.value = String(state.hour);
    const clk = $('.w3d-clock'); if (clk) clk.textContent = fmtHour(state.hour);
  }

  // ---------- Weather ----------
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
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9fc8e8, size: 0.55, transparent: true, opacity: 0.7 }));
  rain.visible = false; rain.frustumCulled = false; scene.add(rain);
  const clouds = new THREE.Group(); scene.add(clouds);
  {
    const r = mulberry32(1234);
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
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
    state.weather = preset;
    const isRain = preset === 'rain';
    const isCloudy = preset === 'cloudy' || isRain;
    const isDusk = preset === 'dusk';
    const isIndoor = preset === 'indoor';
    const isMist = preset === 'mist';
    const isGolden = preset === 'golden-hour';
    const isBreeze = preset === 'breeze';
    rain.visible = isRain;
    clouds.visible = isCloudy || isBreeze;
    if (isMist) scene.fog = new THREE.Fog(0xa8b4bd, 25, 190);
    else if (isRain || isCloudy) scene.fog = new THREE.Fog(0x9aa8b5, 60, 320);
    else if (isDusk || isGolden) scene.fog = new THREE.Fog(0x6b4a5a, 80, 420);
    else scene.fog = null;
    if (isDusk) { applyTimeOfDay(18.4); } else if (isGolden) { applyTimeOfDay(17.6); } else { applyTimeOfDay(state.hour); }
    if (isIndoor) {
      // warm steady interior light: dim the sky dome, hide sun/moon/stars, raise ambient
      skyUniforms.topColor.value.multiplyScalar(0.45);
      skyUniforms.bottomColor.value.multiplyScalar(0.6);
      sun.visible = false; moon.visible = false; stars.material.opacity = 0;
      sunLight.intensity = 1.5; sunLight.color.setHex(0xffd9a0);
      ambient.intensity = 0.55;
    } else {
      ambient.intensity = 0.25;
      sunLight.intensity *= isRain ? 0.45 : (isCloudy ? 0.7 : (isMist ? 0.55 : (isGolden ? 0.9 : 1)));
    }
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
    if (d.model_status === 'not-hosted') {
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
          loader.load(prop.model, (gltf) => {
            gltf.scene.position.set(px, 0, pz); gltf.scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
            ig.add(gltf.scene);
          }, undefined, () => fallback());
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
    let best = null, bd = 4.5;
    for (const n of npcs) { const d = Math.hypot(n.pos[0] - avatarPos.x, n.pos[1] - avatarPos.z); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  function interact() {
    const npc = nearestNPC();
    if (npc) { openDialogue(npc); return; }
    if (state.insideBuilding) {
      const it = interiors.get(state.insideBuilding);
      if (it && Math.hypot(avatarPos.x - 0, avatarPos.z - (it.roomSize[2] / 2 - 1.5)) < 2.2) { exitInterior(); return; }
    }
    const near = state.nearBuilding;
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
  let dialogNPC = null, dialogLine = 0;
  function openDialogue(npc) {
    dialogNPC = npc; dialogLine = 0;
    $('.w3d-dialog-name').textContent = npc.def.name + (npc.def.role ? ' — ' + npc.def.role : '');
    $('.w3d-dialog-line').textContent = (npc.def.dialogue && npc.def.dialogue[0]) || '…';
    const qb = $('.w3d-dialog-quest');
    const qid = npc.def.quest;
    qb.hidden = !(qid && questsById[qid] && !state.questsAccepted[qid]);
    qb.textContent = qid && questsById[qid] ? `Accept quest: ${questsById[qid].title}` : 'Accept quest';
    $('.w3d-dialog').hidden = false;
  }
  $('.w3d-dialog-next').addEventListener('click', () => {
    if (!dialogNPC) return;
    const lines = dialogNPC.def.dialogue || [];
    dialogLine = (dialogLine + 1) % Math.max(lines.length, 1);
    $('.w3d-dialog-line').textContent = lines[dialogLine] || '…';
  });
  $('.w3d-dialog-close').addEventListener('click', () => { $('.w3d-dialog').hidden = true; dialogNPC = null; });
  $('.w3d-dialog-quest').addEventListener('click', () => {
    if (!dialogNPC || !dialogNPC.def.quest) return;
    acceptQuest(dialogNPC.def.quest);
    $('.w3d-dialog-quest').hidden = true;
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
  const clockEl = $('.w3d-clock');
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
    if (state.dayCycle && !($('.w3d-time input') === document.activeElement)) {
      applyTimeOfDay(state.hour + dt * 0.15); // ~4 min per full day at 60fps; slider overrides
    } else applyTimeOfDay(state.hour);
    if (clockEl) clockEl.textContent = fmtHour(state.hour);

    // weather animation
    if (rain.visible) {
      const pos = rainGeo.attributes.position;
      for (let i = 0; i < RAIN_N; i++) {
        let y = pos.getY(i) - rainVel[i] * dt;
        if (y < 0) { y = 55 + Math.random() * 5; pos.setX(i, avatarPos.x + (Math.random() - 0.5) * 120); pos.setZ(i, avatarPos.z + (Math.random() - 0.5) * 120); }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    if (clouds.visible) clouds.children.forEach((c) => {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 200) c.position.x = -200;
    });
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
    teleport(pos) {
      if (!Array.isArray(pos) || pos.length < 3) return;
      if (state.insideBuilding) { state.insideBuilding = null; interiorGroup.visible = false; }
      avatarPos.set(pos[0], pos[1], pos[2]); avatar.position.copy(avatarPos); velY = 0;
    },
    state,
  };
  return controller;
}
