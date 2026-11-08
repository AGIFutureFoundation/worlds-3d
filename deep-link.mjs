// deep-link.mjs — M2: one deep-link reader for the worlds-3d flagship worlds
// (STAGED). Pure function: no DOM, no fetch, no window, no localStorage.
// It takes a query string (or a full URL) and the generated registry object
// (registry.json) and returns a resolved target — or a clean "not found"
// result. It never crashes and never guesses a fallback.
//
// Contract (see DEEP_LINK_CONTRACT.md, v1):
//   player.html?world=<flagship-id>[&station=<station-id>][&simulation=<sim-id>][&tour=<quest-id>]
//   explore.html?world=<flagship-id>[&station=<station-id>][&simulation=<sim-id>][&tour=<quest-id>]
// Canonical param names: `station` and `simulation`. The retired overlay
// spelling `sim` is NOT honoured (it is recorded in `ignored`); a tour is a
// quest id, resolved against the world's quests.
//
// Precedence when several of station/simulation/tour are present:
// simulation > station > tour (matches explore.js, which renders a sim
// before a station). The highest-precedence present param is the target;
// lower-precedence present params are recorded in `ignored` as superseded.
// A present param whose id does not exist in the world is an error, not a
// reason to fall through to another param.
//
// Failure behaviour: on any failure the result has ok:false and a precise
// error code. When the world itself was valid, the world object is included
// so the CALLER (player/explore) may fall back to the world view, per the
// plan's fallback pattern — the reader itself never substitutes a target.
//
// Id format (contract v1): a param value must match /^[a-z0-9][a-z0-9-]*$/
// (lowercase alphanumerics and hyphens, as every real id in the registry
// does). A value that fails the format is `malformed`. An empty value is
// treated as absent.

export const CANONICAL_PARAMS = ['world', 'station', 'simulation', 'tour'];
export const RETIRED_PARAMS = { sim: 'retired spelling — use simulation=' };
export const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function extractQuery(input) {
  if (typeof input !== 'string') return '';
  const s = input.trim();
  if (!s) return '';
  // Full URL (has a scheme) -> take its query part.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
    try {
      return new URL(s).search.slice(1);
    } catch (e) {
      return s;
    }
  }
  const q = s.indexOf('?');
  return (q >= 0 ? s.slice(q + 1) : s).replace(/^\?/, '');
}

function buildIndex(registry) {
  const worlds = new Map();
  for (const w of registry.worlds || []) worlds.set(w.id, w);
  const byWorld = new Map(); // worldId -> { stations: Map, simulations: Map, quests: Map }
  for (const w of registry.worlds || []) {
    byWorld.set(w.id, { stations: new Map(), simulations: new Map(), quests: new Map() });
  }
  for (const s of registry.stations || []) {
    const m = byWorld.get(s.world_id);
    if (m) m.stations.set(s.id, s);
  }
  for (const s of registry.simulations || []) {
    const m = byWorld.get(s.world_id);
    if (m) m.simulations.set(s.id, s);
  }
  for (const q of registry.quests || []) {
    const m = byWorld.get(q.world_id);
    if (m) m.quests.set(q.id, q);
  }
  return { worlds, byWorld };
}

function canonicalUrls(worldId, kind, targetId) {
  const base = 'world=' + encodeURIComponent(worldId);
  let extra = '';
  if (kind === 'station') extra = '&station=' + encodeURIComponent(targetId);
  else if (kind === 'simulation') extra = '&simulation=' + encodeURIComponent(targetId);
  else if (kind === 'tour') extra = '&tour=' + encodeURIComponent(targetId);
  return {
    player: 'player.html?' + base + extra,
    explore: 'explore.html?' + base + extra,
  };
}

// Resolve a deep link. `input` is a query string ("?world=...&station=...")
// or a full URL; `registry` is the parsed registry.json object.
// Returns { ok, kind, world, station, simulation, tour, ignored, urls } on
// success, or { ok:false, error, param, requested, world, ignored } on
// failure. Never throws on bad input (a non-object registry is the only
// programmer error, reported as ok:false, error:'bad_registry').
export function resolveDeepLink(input, registry) {
  const ignored = [];
  const requested = { world: null, station: null, simulation: null, tour: null };

  if (!isPlainObject(registry) || !Array.isArray(registry.worlds)) {
    return { ok: false, error: 'bad_registry', param: null, requested, world: null, ignored };
  }

  const params = new URLSearchParams(extractQuery(input));

  // Record unknown params (and the retired `sim` spelling) as ignored.
  for (const key of new Set(params.keys())) {
    if (CANONICAL_PARAMS.includes(key)) continue;
    const value = params.get(key);
    ignored.push({
      param: key,
      value,
      reason: key in RETIRED_PARAMS ? RETIRED_PARAMS[key] : 'unknown parameter — ignored',
    });
  }

  for (const p of CANONICAL_PARAMS) {
    const v = params.get(p);
    if (v !== null && v !== '') requested[p] = v;
  }

  const { worlds, byWorld } = buildIndex(registry);

  // World is required.
  if (requested.world === null) {
    return { ok: false, error: 'missing_world', param: 'world', requested, world: null, ignored };
  }
  if (!ID_PATTERN.test(requested.world)) {
    return { ok: false, error: 'malformed', param: 'world', requested, world: null, ignored };
  }
  const world = worlds.get(requested.world) || null;
  if (!world) {
    return {
      ok: false,
      error: 'world_not_found',
      param: 'world',
      requested,
      world: null,
      ignored,
      known_worlds: [...worlds.keys()].sort(),
    };
  }

  const idx = byWorld.get(world.id);

  // Precedence: simulation > station > tour. A present param that fails
  // format or does not exist in this world is an error, not a fall-through.
  const order = [
    { param: 'simulation', kind: 'simulation', map: idx.simulations, error: 'simulation_not_found' },
    { param: 'station', kind: 'station', map: idx.stations, error: 'station_not_found' },
    { param: 'tour', kind: 'tour', map: idx.quests, error: 'tour_not_found' },
  ];
  let primary = null;
  for (const entry of order) {
    const value = requested[entry.param];
    if (value === null) continue;
    if (!ID_PATTERN.test(value)) {
      return { ok: false, error: 'malformed', param: entry.param, requested, world, ignored };
    }
    const target = entry.map.get(value) || null;
    if (!target) {
      return { ok: false, error: entry.error, param: entry.param, requested, world, ignored };
    }
    primary = { kind: entry.kind, param: entry.param, target };
    break;
  }

  // Any other present canonical param is superseded by the primary target.
  for (const entry of order) {
    if (primary && entry.param === primary.param) continue;
    if (requested[entry.param] !== null) {
      ignored.push({
        param: entry.param,
        value: requested[entry.param],
        reason: primary
          ? 'superseded by ' + primary.param + ' (precedence: simulation > station > tour)'
          : 'not resolved (no primary target)',
      });
    }
  }

  const result = {
    ok: true,
    kind: primary ? primary.kind : 'world',
    world,
    station: null,
    simulation: null,
    tour: null,
    ignored,
    urls: canonicalUrls(world.id, primary ? primary.kind : 'world', primary ? primary.target.id : null),
  };
  if (primary) result[primary.kind] = primary.target;
  return result;
}
