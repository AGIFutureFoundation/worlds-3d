/* worlds-3d player — loads one flagship world definition from window.WORLDS_DATA
   (data.js, generated — no fetch) and mounts the engine. Unknown ?world= ids
   show a friendly error listing the playable worlds; never a blank page. */
import { mountWorld } from './engine/engine.js';

var FLAGSHIP_ORDER = [
  'agi-corp-hub',
  'smartciti-holodeck',
  'cognition-x',
  'locator-x',
  'biota-blockchain',
  'empathic-x',
  'diagnostic-x'
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function el(id) { return document.getElementById(id); }

function showUnknown(data, requested) {
  var host = el('unknown');
  var app = el('app');
  if (app) app.hidden = true;
  var info = el('info-panel');
  if (info) info.hidden = true;
  var toggle = el('info-toggle');
  if (toggle) toggle.hidden = true;
  document.title = 'World not found — worlds-3d';
  var list = FLAGSHIP_ORDER.filter(function (id) { return data.flagships[id]; })
    .map(function (id) {
      var w = data.flagships[id];
      return '<li><a href="player.html?world=' + encodeURIComponent(id) + '">' + esc(w.name) + '</a> — ' + esc(w.status) + '</li>';
    }).join('');
  host.hidden = false;
  host.innerHTML = '<h2>That world is not playable here yet</h2>'
    + (requested
      ? '<p>No playable world with id <code>' + esc(requested) + '</code> exists in this build.</p>'
      : '<p>No world was selected. Pick one of the playable worlds below.</p>')
    + '<p>The lobby lists all 544 WorldForge worlds; these 7 are the playable flagships:</p>'
    + '<ul>' + list + '</ul>'
    + '<p><a class="btn" href="index.html">← Back to the lobby</a></p>';
}

function fillInfo(world) {
  var host = el('info-panel');
  if (!host) return;
  var coords = world.coordinates
    ? 'Anchor ' + world.coordinates.lat.toFixed(5) + ', ' + world.coordinates.lon.toFixed(5)
    : 'No coordinates — demo lobby, no real-world location claimed.';
  var missing = (world.missing_models || []).length;
  var missingNote = missing === 0
    ? 'All models local — the only world whose 3D models exist on disk.'
    : missing + ' fabric model refs are unhosted, so the engine shows labelled procedural placeholders for them — never faked as the real models.';
  var companions = (world.agent_companions || []).map(function (c) {
    return '<li><strong>' + esc(c.name) + '</strong> — ' + esc(c.role) + '</li>';
  }).join('');
  var sources = (world.sources || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
  host.innerHTML = '<h2>' + esc(world.name) + '</h2>'
    + '<p class="series">' + esc(world.series || '') + ' · ' + esc(world.biome || '') + '</p>'
    + '<p><span class="badge ' + (world.status === 'anchored' ? 'badge-anchored' : 'badge-demo') + '">'
    + esc(world.status.toUpperCase()) + ' · NOT LIVE ON RP1</span></p>'
    + '<p>' + esc(coords) + '</p>'
    + (world.fabric_url ? '<p>Fabric: <a href="' + esc(world.fabric_url) + '" target="_blank" rel="noopener">live fabric JSON on Pages ↗</a></p>' : '<p>No fabric file — built from the local Hub scene JSON.</p>')
    + '<p>' + (world.districts || []).length + ' districts · '
    + (world.buildings || []).length + ' buildings · '
    + (world.npcs || []).length + ' NPCs · '
    + (world.quests || []).length + ' quests · '
    + (world.collectibles || []).length + ' collectibles</p>'
    + '<p>' + esc(missingNote) + '</p>'
    + (companions ? '<h3>Agent companions</h3><ul>' + companions + '</ul>'
    + '<p class="note">Meet the real agents: <a href="https://app.virtuals.io/acp" target="_blank" rel="noopener">Virtuals ACP marketplace ↗</a> · <a href="https://fellowship-chat.pages.dev/#agents" target="_blank" rel="noopener">Worlds Hub Agents ↗</a>. All 5 are listed but offline — no hire can be fulfilled today.</p>' : '')
    + (sources ? '<h3>Sources</h3><ul class="sources">' + sources + '</ul>' : '')
    + '<p class="note">Web 3D interpretation — not RP1, not footage. Companions are game characters representing the real Virtuals agents; their live instances are offline.</p>';
}

function init() {
  var data = window.WORLDS_DATA;
  var err = el('data-error');
  if (!data || !data.flagships) {
    if (err) err.hidden = false;
    return;
  }
  var params = new URLSearchParams(window.location.search);
  var id = params.get('world');
  var world = id ? data.flagships[id] : null;
  if (!world) {
    showUnknown(data, id);
    return;
  }
  document.title = world.name + ' — worlds-3d';
  var title = el('world-title');
  if (title) title.textContent = world.name;
  fillInfo(world);
  var controller = mountWorld(el('app'), world, {});
  window.__world = controller;
  window.__worldDef = world;
  var toggle = el('info-toggle');
  var panel = el('info-panel');
  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      panel.classList.toggle('open');
      toggle.textContent = panel.classList.contains('open') ? '✕ Close info' : 'ⓘ World info';
    });
    // Desktop starts with the panel open (the sidebar is part of the layout);
    // mobile starts closed (it slides over the scene). The toggle then works
    // the same way on both: .open means visible. (Playtest 2026-11-06: the
    // button label flipped but the panel never hid on desktop, because .open
    // only had a rule inside the mobile media query.)
    if (window.matchMedia && !window.matchMedia('(max-width: 760px)').matches) {
      panel.classList.add('open');
      toggle.textContent = '✕ Close info';
    }
  }
}

init();
