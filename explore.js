/* worlds-3d explore — stations & simulations companion to the 3D player.
   ADDITIVE page: it mounts the engine through its public API only
   (mountWorld + controller.teleport) and adds its own side panel; it never
   edits engine.js, player.js or the engine HUD. Works without WebGL too:
   the engine returns a no-op controller and the panel + simulation runner
   still work. Simulation progress is local only (localStorage), never sent
   anywhere.
   STAGED WIRING (M2): deep links are resolved through the deep-link
   reader (resolvePlayerTarget, contract v1) against
   window.WORLDS_REGISTRY (registry-data.js, generated from the M1
   registry) — canonical `station` / `simulation` / `tour` names,
   precedence simulation > station > tour, retired `sim=` NOT honoured
   (recorded, and the panel says so). The reader only decides WHAT to
   open; the simulation runner (step-order enforcement, localStorage
   progress) is unchanged. A tour link opens the tour UI panel. A failed
   station/sim/tour in a valid world falls back to the world list with a
   notice; an unknown world shows the unknown page. When the registry
   did not load, the page falls back to the legacy ?world= behaviour. */
import { mountWorld } from './engine/engine.js';
import { resolvePlayerTarget } from './shared/deep-link-target.js';
import { createTourUI } from './tour-ui/tour-ui.js';

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
function params() { return new URLSearchParams(window.location.search); }

function stationById(world, id) {
  return stationsOf(world).find(function (s) { return s.id === id; }) || null;
}
function simulationById(world, id) {
  return simulationsOf(world).find(function (s) { return s.id === id; }) || null;
}
// D1 (deep-debug 2026-11-07): the M1 registry is the source of truth for
// stations / simulations (contract v1, same as the player). data.js
// flagships may not embed them — the live data.js shipped 2026-11-07
// 23:27 PST has stations: 0 / simulations: 0 in all 7 flagships, which
// made this page render "0 stations · 0 simulations" and silently drop
// registry-resolved ?station= / ?simulation= deep links (the dispatch
// re-validated the registry target against the empty data.js arrays).
// Registry-first, data.js as fallback: when the registry has entries
// for the world they win; otherwise the embedded arrays are used, so
// the page works from file:// with an old data.js too.
function registryStations(worldId) {
  var reg = (typeof window !== 'undefined') ? window.WORLDS_REGISTRY || null : null;
  if (!reg || !Array.isArray(reg.stations)) return [];
  return reg.stations.filter(function (s) { return s.world_id === worldId; });
}
function registrySimulations(worldId) {
  var reg = (typeof window !== 'undefined') ? window.WORLDS_REGISTRY || null : null;
  if (!reg || !Array.isArray(reg.simulations)) return [];
  return reg.simulations.filter(function (s) { return s.world_id === worldId; });
}
function stationsOf(world) {
  var fromReg = world && world.id ? registryStations(world.id) : [];
  if (fromReg.length) return fromReg;
  return (world && world.stations) || [];
}
function simulationsOf(world) {
  var fromReg = world && world.id ? registrySimulations(world.id) : [];
  if (fromReg.length) return fromReg;
  return (world && world.simulations) || [];
}
function buildingById(world, id) {
  return (world.buildings || []).find(function (b) { return b.id === id; }) || null;
}
function exploreUrl(worldId, extra) {
  var q = 'explore.html?world=' + encodeURIComponent(worldId);
  if (extra) q += '&' + extra;
  return q;
}
function playerUrl(worldId) {
  return 'player.html?world=' + encodeURIComponent(worldId);
}

function simKey(worldId, simId) { return 'w3d-sim-' + worldId + '-' + simId; }
function simDone(worldId, simId) {
  try {
    return JSON.parse(localStorage.getItem(simKey(worldId, simId)) || '[]');
  } catch (e) { return []; }
}
function simSetDone(worldId, simId, done) {
  try { localStorage.setItem(simKey(worldId, simId), JSON.stringify(done)); } catch (e) {}
}

/* RE-BASED (Batch D fix worker, 2026-11-07): the Phase E-A assessment
   wiring above, re-based onto the POST-C-sync wired explore.js (M2 deep-link
   reader, head 44c06e25). Same __ASSESSMENT__ helpers and integration points
   as the pre-wiring staged copy; the wiring code is untouched. Also folded
   in below: D1 registry-first stations/sims (workaround only — the M1 live
   run is the root fix) and H2 legacy ?simulation=/?station= fallback. */
/* __ASSESSMENT_BEGIN__ — Phase 4 assessment wiring (STAGED, Phase E-A).
   Writes one localStorage record per attempt, key w3d-assess-<worldId>-<simId>-<attemptId>,
   per phase4-training-sims/ASSESSMENT.md + assessment-schema.json (schema
   "phase4-assessment-attempt/1"). localStorage only; never a server; learner_id is an
   opaque local pseudonym, never a name or email. Evidence is ALWAYS 'attested': the
   runner cannot verify a step's check; marking a step done is self-attestation. No
   grader exists; none is invented here. A 'passed' record means "the learner marked
   every step done, in order" — it is NOT a verified result and must never be presented
   as one. An 'incomplete' record names the next undone step as a 'skipped' entry so
   the step the attempt stopped at is identified by step_id in the record. */
var ASSESS_SCHEMA = 'phase4-assessment-attempt/1';
var ASSESS_INDEX_KEY = 'w3d-assess-index';
var ASSESS_LEARNER_KEY = 'w3d-assess-learner';

function assessStore() {
  try { return (typeof localStorage !== 'undefined') ? localStorage : null; } catch (e) { return null; }
}
function assessNowIso() { return new Date().toISOString(); }
function assessRandomId(prefix) {
  var rnd = '';
  try { rnd = Math.random().toString(16).slice(2, 8); } catch (e) { rnd = '000000'; }
  return prefix + Date.now().toString(36) + '-' + rnd;
}
function assessKey(worldId, simId, attemptId) { return 'w3d-assess-' + worldId + '-' + simId + '-' + attemptId; }
function assessActiveKey(worldId, simId) { return 'w3d-assess-active-' + worldId + '-' + simId; }
function assessLearnerId() {
  var store = assessStore();
  if (!store) return 'learner-anonymous';
  var id = null;
  try { id = store.getItem(ASSESS_LEARNER_KEY); } catch (e) {}
  if (!id) {
    id = assessRandomId('learner-');
    try { store.setItem(ASSESS_LEARNER_KEY, id); } catch (e) {}
  }
  return id;
}
var assessSessionId = assessRandomId('session-');
var assessLastKey = {}; /* 'worldId:simId' -> last record key written this page session */
function assessBegin(worldId, sim) {
  var store = assessStore();
  if (!store || !sim) return null;
  var done = simDone(worldId, sim.id);
  var steps = sim.steps || [];
  if (done.length >= steps.length) return null; /* already complete: no new attempt */
  var active = null;
  try { active = JSON.parse(store.getItem(assessActiveKey(worldId, sim.id)) || 'null'); } catch (e) { active = null; }
  if (active && active.attempt_id) return active;
  active = { attempt_id: assessRandomId('att-'), started_at: assessNowIso() };
  try { store.setItem(assessActiveKey(worldId, sim.id), JSON.stringify(active)); } catch (e) {}
  return active;
}
function assessActive(worldId, simId) {
  var store = assessStore();
  if (!store) return null;
  try { return JSON.parse(store.getItem(assessActiveKey(worldId, simId)) || 'null'); } catch (e) { return null; }
}
function assessEndAttempt(worldId, simId) {
  var store = assessStore();
  if (!store) return;
  try { store.removeItem(assessActiveKey(worldId, simId)); } catch (e) {}
}
function assessOrderCorrect(sim, done) {
  var steps = sim.steps || [];
  if (done.length > steps.length) return false;
  for (var i = 0; i < done.length; i++) { if (done[i] !== steps[i].id) return false; }
  return true;
}
function assessWriteRecord(worldId, sim, record) {
  var store = assessStore();
  if (!store) return null;
  var key = assessKey(worldId, sim.id, record.attempt_id);
  try {
    if (store.getItem(key)) return null; /* duplicate attempt_id: never overwrite */
    store.setItem(key, JSON.stringify(record));
    var index = [];
    try { index = JSON.parse(store.getItem(ASSESS_INDEX_KEY) || '[]'); } catch (e) { index = []; }
    if (index.indexOf(record.attempt_id) === -1) index.push(record.attempt_id);
    store.setItem(ASSESS_INDEX_KEY, JSON.stringify(index));
  } catch (e) { return null; }
  assessLastKey[worldId + ':' + sim.id] = key;
  return key;
}
function assessBuildRecord(worldId, sim, active, outcome) {
  var steps = sim.steps || [];
  var done = simDone(worldId, sim.id);
  var completedAt = assessNowIso();
  var startedMs = Date.parse(active.started_at);
  var duration = isNaN(startedMs) ? 0 : Math.max(0, Math.floor((Date.parse(completedAt) - startedMs) / 1000));
  var attempted = done.map(function (stepId, i) {
    /* 'correct' here means self-marked done; the record's evidence field ('attested')
       is what says so. No reason text is collected by the runner, so note stays ''. */
    return { step_id: stepId, position: i + 1, result: 'correct', note: '' };
  });
  if (outcome === 'incomplete') {
    var next = steps[done.length] || null;
    if (next) attempted.push({ step_id: next.id, position: done.length + 1, result: 'skipped', note: 'Attempt ended here — next undone step.' });
  }
  return {
    schema: ASSESS_SCHEMA,
    attempt_id: active.attempt_id,
    learner_id: assessLearnerId(),
    cohort_id: '',
    world_id: worldId,
    sim_id: sim.id,
    scenario_id: '',
    started_at: active.started_at,
    completed_at: completedAt,
    duration_seconds: duration,
    steps_attempted: attempted,
    order_correct: assessOrderCorrect(sim, done),
    outcome: outcome,
    evidence: 'attested',
    hints_used: 0,
    source: 'web',
    session_id: assessSessionId
  };
}
function assessFinishIfComplete(worldId, sim) {
  var steps = sim.steps || [];
  var done = simDone(worldId, sim.id);
  if (!steps.length || done.length !== steps.length) return null;
  var active = assessActive(worldId, sim.id);
  if (!active) return null; /* no open attempt (e.g. re-opened completed sim): write nothing */
  var key = assessWriteRecord(worldId, sim, assessBuildRecord(worldId, sim, active, 'passed'));
  if (key) assessEndAttempt(worldId, sim.id);
  return key;
}
function assessSaveIncomplete(worldId, sim) {
  if (!sim) return null;
  var steps = sim.steps || [];
  var done = simDone(worldId, sim.id);
  if (!done.length || done.length >= steps.length) return null; /* nothing attempted, or complete */
  var active = assessActive(worldId, sim.id);
  if (!active) return null;
  var key = assessWriteRecord(worldId, sim, assessBuildRecord(worldId, sim, active, 'incomplete'));
  if (key) assessEndAttempt(worldId, sim.id);
  return key;
}
function assessRecordNote(worldId, simId) {
  var key = assessLastKey[worldId + ':' + simId];
  if (!key) return '';
  return ' <span class="xpl-note">Assessment record written (attested — self-marked, not verified): <code>' + esc(key) + '</code></span>';
}
if (typeof window !== 'undefined') {
  window.W3D_ASSESSMENT = {
    assessBegin: assessBegin,
    assessFinishIfComplete: assessFinishIfComplete,
    assessSaveIncomplete: assessSaveIncomplete,
    assessKey: assessKey,
    assessLearnerId: assessLearnerId,
    schema: ASSESS_SCHEMA
  };
}
/* __ASSESSMENT_END__ */

/* ---------------- directory (no ?world=) ---------------- */
function renderDirectory(data) {
  var app = el('app');
  var panel = el('explore-panel');
  var main = document.querySelector('.player-main');
  if (app) app.hidden = true;
  if (panel) panel.hidden = true;
  if (main) main.hidden = true;
  var host = el('directory');
  host.hidden = false;
  document.title = 'Explore — stations & simulations — worlds-3d';
  var title = el('explore-title');
  if (title) title.textContent = 'Explore — stations & simulations';
  var totalStations = 0, totalSims = 0;
  FLAGSHIP_ORDER.forEach(function (id) {
    var w = data.flagships[id];
    if (!w) return;
    totalStations += stationsOf(w).length;
    totalSims += simulationsOf(w).length;
  });
  var html = '<h2>Stations &amp; simulations in the 7 playable worlds</h2>'
    + '<p>' + totalStations + ' stations · ' + totalSims + ' simulations · '
    + 'every simulation is labelled as a simulation, and none of them certifies, '
    + 'diagnoses, treats, or qualifies anyone. Stations are furnished rooms inside '
    + 'real buildings already in each world — walk in through the door in the 3D '
    + 'player, or open one here and teleport to its door.</p>'
    + '<p><a href="index.html">← Back to the lobby</a></p>';
  FLAGSHIP_ORDER.forEach(function (id) {
    var w = data.flagships[id];
    if (!w) return;
    html += '<section class="xpl-world"><h3>' + esc(w.name) + '</h3>'
      + '<p class="xpl-counts">' + esc(w.series || '') + ' · '
      + stationsOf(w).length + ' stations · '
      + simulationsOf(w).length + ' simulations · '
      + '<a href="' + esc(playerUrl(w.id)) + '">▶ Play in 3D</a> · '
      + '<a href="' + esc(exploreUrl(w.id)) + '">Explore here</a></p><ul>';
    stationsOf(w).forEach(function (s) {
      html += '<li><a href="' + esc(exploreUrl(w.id, 'station=' + encodeURIComponent(s.id))) + '">'
        + esc(s.name) + '</a> — ' + esc(s.kind) + '</li>';
    });
    simulationsOf(w).forEach(function (s) {
      html += '<li><span class="xpl-sim-tag">SIMULATION</span> <a href="'
        + esc(exploreUrl(w.id, 'simulation=' + encodeURIComponent(s.id))) + '">'
        + esc(s.title) + '</a></li>';
    });
    html += '</ul></section>';
  });
  html += '<p class="xpl-note">Web 3D interpretation — not RP1, not footage. '
    + 'Stations and simulations are training content inside the game worlds.</p>';
  host.innerHTML = html;
}

/* ---------------- unknown world ---------------- */
function showUnknown(data, requested) {
  var host = el('unknown');
  var app = el('app');
  var panel = el('explore-panel');
  if (app) app.hidden = true;
  if (panel) panel.hidden = true;
  document.title = 'World not found — worlds-3d';
  var list = FLAGSHIP_ORDER.filter(function (id) { return data.flagships[id]; })
    .map(function (id) {
      var w = data.flagships[id];
      return '<li><a href="' + esc(exploreUrl(id)) + '">' + esc(w.name) + '</a> — ' + esc(w.status) + '</li>';
    }).join('');
  host.hidden = false;
  host.innerHTML = '<h2>That world is not playable here yet</h2>'
    + (requested
      ? '<p>No playable world with id <code>' + esc(requested) + '</code> exists in this build.</p>'
      : '<p>No world was selected. Pick one of the playable worlds below.</p>')
    + '<p>The lobby lists all 544 WorldForge worlds; these 7 are the playable flagships:</p>'
    + '<ul>' + list + '</ul>'
    + '<p><a class="btn" href="index.html">← Back to the lobby</a> · '
    + '<a class="btn" href="explore.html">All stations &amp; simulations</a></p>';
}

/* ---------------- world panel ---------------- */
// `link` is the resolved deep link (resolvePlayerTarget, M2) — or null
// when the caller fell back to the legacy path. The reader only decides
// WHAT to open; the sim runner below is unchanged.
function worldPanel(world, controller, link) {
  var host = el('explore-panel');
  var worldId = world.id;
  var view = { station: null, simulation: null };

  function buildingDoor(b) {
    var pos = b.position || [0, 0, 0];
    var size = b.size || [10, 6, 10];
    return [pos[0], 2, pos[2] + size[2] / 2 + 3];
  }
  function goToStation(st) {
    var b = st.building ? buildingById(world, st.building) : null;
    if (b && controller && typeof controller.teleport === 'function') {
      controller.teleport(buildingDoor(b));
    }
  }
  function stationTools(st) {
    if (!st.tools || !st.tools.length) return '';
    return '<h4>What is in the room</h4><ul>'
      + st.tools.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
  }
  function stationProps(st) {
    var b = st.building ? buildingById(world, st.building) : null;
    var props = b && b.interior && b.interior.rooms && b.interior.rooms[0]
      ? (b.interior.rooms[0].props || []) : [];
    var labelled = props.filter(function (p) { return p.label; });
    if (!labelled.length) return '';
    return '<h4>Furnishings in this room</h4><ul>'
      + labelled.map(function (p) { return '<li>' + esc(p.label) + '</li>'; }).join('') + '</ul>';
  }
  function sourcesHtml(list) {
    if (!list || !list.length) return '';
    return '<p class="xpl-sources">Sources: ' + list.map(esc).join(' · ') + '</p>';
  }

  function renderList() {
    /* STAGED PATCH: leaving a sim mid-attempt writes its 'incomplete' record first. */
    var leavingSim = view.simulation ? simulationById(world, view.simulation) : null;
    if (leavingSim) assessSaveIncomplete(worldId, leavingSim);
    view.station = null; view.simulation = null;
    var stations = stationsOf(world);
    var sims = simulationsOf(world);
    var html = '<h2>' + esc(world.name) + '</h2>'
      + '<p class="xpl-kind">' + esc(world.series || '') + ' · ' + esc(world.biome || '') + '</p>'
      + '<p><a href="' + esc(playerUrl(worldId)) + '">Open in the plain player</a> · '
      + '<a href="explore.html">All worlds</a></p>'
      + '<h3>Stations (' + stations.length + ')</h3>';
    if (!stations.length) {
      html += '<p>No stations defined for this world yet.</p>';
    } else {
      html += '<ul class="xpl-station-list">' + stations.map(function (s) {
        return '<li><button type="button" class="xpl-go" data-station="' + esc(s.id) + '">'
          + esc(s.name) + '</button> <span class="xpl-kind">' + esc(s.kind) + '</span></li>';
      }).join('') + '</ul>';
    }
    html += '<h3>Simulations (' + sims.length + ')</h3>';
    if (!sims.length) {
      html += '<p>No simulations defined for this world yet.</p>';
    } else {
      html += '<ul class="xpl-station-list">' + sims.map(function (s) {
        return '<li><span class="xpl-sim-tag">SIMULATION</span> '
          + '<button type="button" class="xpl-go" data-simulation="' + esc(s.id) + '">'
          + esc(s.title) + '</button></li>';
      }).join('') + '</ul>';
    }
    html += '<h3>Tours (' + (world.quests || []).length + ')</h3>';
    if (!(world.quests || []).length) {
      html += '<p>No tours defined for this world yet.</p>';
    } else {
      // A tour IS a quest (contract v1): each quest opens here as a
      // guided tour (?tour=<quest-id>), with its steps in order.
      html += '<ul class="xpl-station-list">' + (world.quests || []).map(function (q) {
        return '<li>🧭 <a href="' + esc(exploreUrl(worldId, 'tour=' + encodeURIComponent(q.id))) + '">'
          + esc(q.title) + '</a> <span class="xpl-kind">' + (q.steps || []).length + ' steps</span></li>';
      }).join('') + '</ul>';
    }
    html += '<p class="xpl-note">Stations are furnished rooms inside this world\'s real '
      + 'buildings. Simulations are step-by-step practice runs — they never certify, '
      + 'diagnose, treat, or qualify anyone, and progress is stored only in your browser.</p>';
    host.innerHTML = html;
    bindList();
  }

  // Tour view (M2): the tour UI panel (tour-ui.js) in the explore panel,
  // fed the resolved quest. Ending the tour returns to the station list.
  function openTour(quest) {
    host.innerHTML = '';
    createTourUI(host, quest, world, {
      onEnd: function () { renderList(); },
    });
  }

  // A short notice at the top of the panel (world-view fallback and the
  // retired ?sim= spelling). Plain text, escaped.
  function showLinkNotice() {
    var msgs = [];
    if (link && link.notice) msgs.push(link.notice);
    if (link && link.retiredNotice) msgs.push(link.retiredNotice);
    if (!msgs.length) return;
    var div = document.createElement('p');
    div.className = 'xpl-note';
    div.textContent = msgs.join(' ');
    host.insertBefore(div, host.firstChild);
  }

  function renderStation(st) {
    view.station = st.id; view.simulation = null;
    var sim = st.simulation ? simulationById(world, st.simulation) : null;
    var b = st.building ? buildingById(world, st.building) : null;
    var html = '<button type="button" class="xpl-back" data-back="1">← All stations</button>'
      + '<h2>' + esc(st.name) + '</h2>'
      + '<p class="xpl-kind">' + esc(st.kind) + ' · ' + esc(st.district || '')
      + (b ? ' · in ' + esc(b.name) : '') + '</p>'
      + '<p>' + esc(st.description || '') + '</p>'
      + '<button type="button" class="xpl-go" data-teleport="' + esc(st.id) + '">➤ Go to this station in 3D</button>'
      + (st.content || []).map(function (c) {
        return '<h4>' + esc(c.heading) + '</h4><p>' + esc(c.text) + '</p>';
      }).join('')
      + stationTools(st) + stationProps(st)
      + (sim ? '<h3>Linked simulation</h3><p><span class="xpl-sim-tag">SIMULATION</span> '
        + '<button type="button" class="xpl-go" data-simulation="' + esc(sim.id) + '">'
        + esc(sim.title) + '</button></p>' : '')
      + sourcesHtml(st.sources)
      + '<p class="xpl-note">Deep link: <a href="' + esc(exploreUrl(worldId, 'station=' + encodeURIComponent(st.id))) + '">'
      + esc(exploreUrl(worldId, 'station=' + encodeURIComponent(st.id))) + '</a></p>';
    host.innerHTML = html;
    bindDetail();
  }

  function renderSimulation(sim) {
    view.simulation = sim.id; view.station = null;
    var done = simDone(worldId, sim.id);
    var steps = sim.steps || [];
    var nextIdx = steps.findIndex(function (s) { return done.indexOf(s.id) === -1; });
    var complete = nextIdx === -1 && steps.length > 0;
    /* STAGED PATCH: begin an attempt on open; write the 'passed' record on completion. */
    assessBegin(worldId, sim);
    if (complete) assessFinishIfComplete(worldId, sim);
    var html = '<button type="button" class="xpl-back" data-back="1">← All simulations</button>'
      + '<h2>' + esc(sim.title) + '</h2>'
      + '<p><span class="xpl-sim-tag">SIMULATION</span></p>'
      + '<p>' + esc(sim.description || '') + '</p>'
      + '<p class="xpl-kind">Roles: ' + esc((sim.roles || []).join(' · ')) + '</p>'
      + (sim.building ? '<p><button type="button" class="xpl-go" data-sim-teleport="'
        + esc(sim.building) + '">➤ Go to the simulation space in 3D</button></p>' : '')
      + '<h3>Steps (' + done.length + ' / ' + steps.length + ' done)</h3><ol>'
      + steps.map(function (s, i) {
        var isDone = done.indexOf(s.id) !== -1;
        var isNext = i === nextIdx;
        return '<li><strong>' + esc(s.title) + '</strong><br>' + esc(s.instruction)
          + '<br><em>Check: ' + esc(s.check) + '</em><br>'
          + '<button type="button" class="xpl-step' + (isDone ? ' done' : '') + '" data-step="'
          + esc(s.id) + '"' + (isDone || isNext ? '' : ' disabled') + '>'
          + (isDone ? '✓ Done' : (isNext ? 'Mark this step done' : 'Complete earlier steps first')) + '</button></li>';
      }).join('') + '</ol>'
      + (complete
        ? '<div class="xpl-complete"><strong>Simulation complete.</strong> ' + esc(sim.success || '') + assessRecordNote(worldId, sim.id) + '</div>'
        : '')
      + '<p><strong>Success looks like:</strong> ' + esc(sim.success || '') + '</p>'
      + '<p class="xpl-note">' + esc(sim.safety_note || '') + '</p>'
      + '<p><button type="button" class="xpl-back" data-reset-sim="' + esc(sim.id) + '">Reset this simulation</button></p>'
      + sourcesHtml(sim.sources)
      + '<p class="xpl-note">Deep link: <a href="' + esc(exploreUrl(worldId, 'simulation=' + encodeURIComponent(sim.id))) + '">'
      + esc(exploreUrl(worldId, 'simulation=' + encodeURIComponent(sim.id))) + '</a></p>';
    host.innerHTML = html;
    bindDetail();
  }

  function bindList() {
    host.querySelectorAll('[data-station]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var st = stationById(world, btn.getAttribute('data-station'));
        if (st) renderStation(st);
      });
    });
    host.querySelectorAll('[data-simulation]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sim = simulationById(world, btn.getAttribute('data-simulation'));
        if (sim) renderSimulation(sim);
      });
    });
  }

  function bindDetail() {
    host.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', renderList);
    });
    host.querySelectorAll('[data-teleport]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var st = stationById(world, btn.getAttribute('data-teleport'));
        if (st) goToStation(st);
      });
    });
    host.querySelectorAll('[data-sim-teleport]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = buildingById(world, btn.getAttribute('data-sim-teleport'));
        if (b && controller && typeof controller.teleport === 'function') {
          controller.teleport(buildingDoor(b));
        }
      });
    });
    host.querySelectorAll('[data-simulation]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sim = simulationById(world, btn.getAttribute('data-simulation'));
        if (sim) renderSimulation(sim);
      });
    });
    host.querySelectorAll('[data-step]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sim = simulationById(world, view.simulation);
        if (!sim) return;
        var done = simDone(worldId, sim.id);
        var stepId = btn.getAttribute('data-step');
        if (done.indexOf(stepId) === -1) done.push(stepId);
        simSetDone(worldId, sim.id, done);
        renderSimulation(sim);
      });
    });
    host.querySelectorAll('[data-reset-sim]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sim = simulationById(world, btn.getAttribute('data-reset-sim'));
        if (!sim) return;
        /* STAGED PATCH: resetting mid-attempt writes its 'incomplete' record first. */
        assessSaveIncomplete(worldId, sim);
        simSetDone(worldId, sim.id, []);
        renderSimulation(sim);
      });
    });
  }

  renderList();
  // Deep-link target (M2, resolved once in init and validated against
  // the registry): open the resolved station / simulation / tour. The
  // sim runner is unchanged — the reader only decides WHAT to open.
  // Precedence is simulation > station > tour (the reader already
  // applied it); a present-but-unknown id fell back to the world list
  // with a notice (link.action 'world' + link.notice).
  if (link && link.action === 'simulation' && link.target) {
    var sim = simulationById(world, link.target.id);
    if (sim) renderSimulation(sim);
  } else if (link && link.action === 'station' && link.target) {
    var st = stationById(world, link.target.id);
    if (st) { renderStation(st); goToStation(st); }
  } else if (link && link.action === 'tour' && link.target) {
    openTour(link.target);
  }
  showLinkNotice();
}

function init() {
  var data = window.WORLDS_DATA;
  var err = el('data-error');
  if (!data || !data.flagships) {
    if (err) err.hidden = false;
    return;
  }
  // Deep-link wiring (M2): resolve the full query against the registry.
  // The reader decides WHAT to open; worldPanel opens the target
  // afterwards. When the registry did not load, fall back to the legacy
  // ?world= path exactly as before.
  var registry = (typeof window !== 'undefined') ? window.WORLDS_REGISTRY || null : null;
  var link = resolvePlayerTarget(window.location.search, registry);
  var title = el('explore-title');
  var id = null;
  var world = null;
  if (link.action === 'legacy') {
    var p = params();
    id = p.get('world');
    if (!id) {
      renderDirectory(data);
      return;
    }
    world = data.flagships[id];
    if (!world) {
      showUnknown(data, id);
      return;
    }
    // Legacy deep links (pre-wiring behaviour): open ?simulation= /
    // ?station= directly from data.js when the registry did not load.
    // Without this, a missing registry-data.js silently degrades sim /
    // station deep links to the world list (the wired explore.js only
    // opens them via the registry-resolved link). Pre-wiring explore.js
    // parsed these params directly; this restores that fallback.
    var legSim = p.get('simulation');
    var legSt = p.get('station');
    if (legSim && simulationById(world, legSim)) {
      link = { action: 'simulation', target: { id: legSim } };
    } else if (legSt && stationById(world, legSt)) {
      link = { action: 'station', target: { id: legSt } };
    }
  } else if (link.action === 'no-world') {
    renderDirectory(data);
    return;
  } else if (link.action === 'unknown-world') {
    showUnknown(data, link.requested);
    return;
  } else {
    id = link.world.id;
    world = data.flagships[id];
    if (!world) {
      showUnknown(data, id);
      return;
    }
  }
  document.title = world.name + ' — explore — worlds-3d';
  if (title) title.textContent = world.name + ' — stations & simulations';
  var controller = null;
  try {
    controller = mountWorld(el('app'), world, {});
    window.__world = controller;
    window.__worldDef = world;
  } catch (e) {
    var app = el('app');
    if (app) app.innerHTML = '<p class="error">The 3D player could not start here (' + esc(e.message || e) + '). The stations and simulations panel still works.</p>';
  }
  worldPanel(world, controller, link);
  var toggle = el('explore-toggle');
  var panel = el('explore-panel');
  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      panel.classList.toggle('open');
      toggle.textContent = panel.classList.contains('open') ? '✕ Close panel' : 'ⓘ Stations & simulations';
    });
    if (window.matchMedia && !window.matchMedia('(max-width: 760px)').matches) {
      panel.classList.add('open');
      toggle.textContent = '✕ Close panel';
    }
  }
}

init();
