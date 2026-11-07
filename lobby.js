/* worlds-3d lobby — renders the 7 playable flagships + the 544-world index.
   Data comes from window.WORLDS_DATA (data.js, generated — no fetch, so this
   works from file:// and from Pages). No backend. */
(function () {
  'use strict';

  var PAGE_SIZE = 24;
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

  function statusBadge(world) {
    if (world.status === 'anchored') return '<span class="badge badge-anchored">ANCHORED · not live on RP1</span>';
    if (world.status === 'demo') return '<span class="badge badge-demo">DEMO LOBBY · not live on RP1</span>';
    return '<span class="badge">PLANNED</span>';
  }

  function coordsText(world) {
    if (!world.coordinates) return 'No coordinates — demo lobby, no real-world location claimed.';
    return 'Anchor ' + world.coordinates.lat.toFixed(5) + ', ' + world.coordinates.lon.toFixed(5);
  }

  function renderFlagships(data) {
    var host = el('flagships');
    if (!host) return;
    var html = '';
    FLAGSHIP_ORDER.forEach(function (id) {
      var w = data.flagships[id];
      if (!w) return;
      var missing = (w.missing_models || []).length;
      var missingNote = missing === 0
        ? 'All models local — the only world whose 3D models exist on disk.'
        : missing + ' fabric model refs unhosted — shown as labelled placeholders, never faked.';
      html += '<article class="card flagship">'
        + '<h3>' + esc(w.name) + '</h3>'
        + '<p class="series">' + esc(w.series || '') + ' · ' + esc(w.biome || '') + '</p>'
        + '<p>' + statusBadge(w) + '</p>'
        + '<p class="coords">' + esc(coordsText(w)) + '</p>'
        + '<p class="counts">' + (w.districts || []).length + ' districts · '
        + (w.buildings || []).length + ' buildings · '
        + (w.npcs || []).length + ' NPCs · '
        + (w.quests || []).length + ' quests · '
        + (w.collectibles || []).length + ' collectibles</p>'
        + '<p class="models">' + esc(missingNote) + '</p>'
        + '<p><a class="btn" href="player.html?world=' + encodeURIComponent(w.id) + '">▶ Play this world</a></p>'
        + '</article>';
    });
    host.innerHTML = html;
  }

  function earthViewerUrl(data) {
    var coll = (data.collections || []).find(function (c) { return c.id === 'worldforge-earth'; });
    return coll ? coll.url : 'https://agifuturefoundation.github.io/WorldForge-Browser/earth/';
  }

  function filterWorlds(data, q, biome, group) {
    q = (q || '').trim().toLowerCase();
    return data.worlds.filter(function (w) {
      if (biome && w.biome !== biome) return false;
      if (group && w.group !== group) return false;
      if (!q) return true;
      return (w.name + ' ' + (w.place || '') + ' ' + w.slug).toLowerCase().indexOf(q) !== -1;
    });
  }

  var state = { q: '', biome: '', group: '', page: 1 };

  function renderList(data) {
    var host = el('world-grid');
    var countEl = el('list-count');
    var pager = el('pagination');
    if (!host) return;
    var filtered = filterWorlds(data, state.q, state.biome, state.group);
    var pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * PAGE_SIZE;
    var slice = filtered.slice(start, start + PAGE_SIZE);
    var viewer = earthViewerUrl(data);
    var html = '';
    slice.forEach(function (w) {
      html += '<article class="card world">'
        + '<h3>' + esc(w.name) + '</h3>'
        + '<p class="place">' + esc(w.place || '') + '</p>'
        + '<p><span class="chip">' + esc(w.biome || '') + '</span> '
        + '<span class="chip">' + esc(w.group || '') + '</span></p>'
        + '<p class="status">Lobby entry — not yet built as a playable world here. '
        + 'All 544 worlds are rp1:null (not live on RP1).</p>'
        + '<p class="links"><a href="' + esc(viewer) + '" target="_blank" rel="noopener">View on WorldForge Earth (live viewer) ↗</a></p>'
        + (w.subdomain ? '<p class="subdomain">Planned subdomain (does not resolve yet): ' + esc(w.subdomain) + '</p>' : '')
        + '</article>';
    });
    if (!slice.length) html = '<p class="empty">No worlds match those filters. <button id="clear-filters" type="button">Clear filters</button></p>';
    host.innerHTML = html;
    if (countEl) countEl.textContent = filtered.length + ' of 544 worlds · page ' + state.page + ' of ' + pages;
    if (pager) {
      var p = '';
      if (state.page > 1) p += '<button data-page="' + (state.page - 1) + '" type="button">← Previous</button>';
      p += '<span> Page ' + state.page + ' / ' + pages + ' </span>';
      if (state.page < pages) p += '<button data-page="' + (state.page + 1) + '" type="button">Next →</button>';
      pager.innerHTML = p;
      pager.querySelectorAll('button[data-page]').forEach(function (b) {
        b.addEventListener('click', function () { state.page = parseInt(b.getAttribute('data-page'), 10); renderList(data); window.scrollTo(0, 0); });
      });
    }
    var clear = el('clear-filters');
    if (clear) clear.addEventListener('click', function () {
      state.q = ''; state.biome = ''; state.group = ''; state.page = 1;
      el('search').value = ''; el('biome').value = ''; el('group').value = '';
      renderList(data);
    });
  }

  function fillSelects(data) {
    var biomes = Array.from(new Set(data.worlds.map(function (w) { return w.biome; }).filter(Boolean))).sort();
    var groups = Array.from(new Set(data.worlds.map(function (w) { return w.group; }).filter(Boolean))).sort();
    var bSel = el('biome');
    var gSel = el('group');
    biomes.forEach(function (b) { var o = document.createElement('option'); o.value = b; o.textContent = b; bSel.appendChild(o); });
    groups.forEach(function (g) { var o = document.createElement('option'); o.value = g; o.textContent = g; gSel.appendChild(o); });
  }

  function init() {
    var data = window.WORLDS_DATA;
    var err = el('data-error');
    if (!data || !data.worlds) {
      if (err) err.hidden = false;
      return;
    }
    var stats = el('stats');
    if (stats) {
      stats.textContent = data.worlds.length + ' worlds in the index · '
        + Object.keys(data.flagships).length + ' playable now in the web 3D engine · 0 live on RP1';
    }
    renderFlagships(data);
    fillSelects(data);
    var search = el('search');
    var biome = el('biome');
    var group = el('group');
    if (search) search.addEventListener('input', function () { state.q = search.value; state.page = 1; renderList(data); });
    if (biome) biome.addEventListener('change', function () { state.biome = biome.value; state.page = 1; renderList(data); });
    if (group) group.addEventListener('change', function () { state.group = group.value; state.page = 1; renderList(data); });
    renderList(data);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
