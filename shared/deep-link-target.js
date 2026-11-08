// deep-link-target.js — shared deep-link → player-action mapping (STAGED).
// Pure function: no DOM, no fetch, no window, no localStorage.
// It wraps the M2 reader (deep-link.mjs) and maps its result to the ONE
// action a player takes, so the three players (static player.js,
// explore.js, IWSDK player.js) share a single decision instead of each
// re-implementing the fallback rules.
//
// Contract (DEEP_LINK_CONTRACT.md v1): canonical params are `world`,
// `station`, `simulation`, `tour`; precedence simulation > station >
// tour; retired `sim=` is NOT honoured.
//
// Actions returned:
//   'world'        — show the world view (world-only link, or a failed
//                    station/sim/tour in a valid world: the plan's
//                    fallback, with `notice` naming what was not found).
//   'station'      — open the station target (`target` = registry station).
//   'simulation'   — open the simulation target (`target` = registry sim).
//   'tour'         — open the tour target (`target` = registry quest).
//   'unknown-world'— the `world` id is not one of the 7 flagships
//                    (`requested` = the id the link asked for).
//   'no-world'     — no `world` param at all (caller shows its directory /
//                    lobby default, as it did before deep links).
//   'legacy'       — no usable registry was supplied (registry missing or
//                    not a registry object). The caller falls back to its
//                    previous `?world=`-only behaviour so the page still
//                    works exactly as before.
//
// `ignored` is passed through from the reader (unknown params, the retired
// `sim=` spelling, superseded params). `retiredNotice` is set when the
// link used the retired `sim=` spelling, so the caller can say so
// plainly instead of silently dropping it.

import { resolveDeepLink } from '../deep-link.mjs';

function isRegistry(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.worlds);
}

function rawWorldParam(search) {
  try {
    const p = new URLSearchParams(
      typeof search === 'string' && search.indexOf('?') >= 0
        ? search.slice(search.indexOf('?') + 1)
        : (search || ''),
    );
    const v = p.get('world');
    return v === null || v === '' ? null : v;
  } catch (e) {
    return null;
  }
}

// Resolve a deep link to a player action. `search` is a query string
// ("?world=...&station=...") or a full URL; `registry` is the parsed
// registry.json object (or null when it did not load). Never throws on
// bad input.
export function resolvePlayerTarget(search, registry) {
  const requested = rawWorldParam(search);

  if (!isRegistry(registry)) {
    return {
      action: 'legacy',
      world: null,
      target: null,
      error: 'no_registry',
      notice: null,
      retiredNotice: null,
      ignored: [],
      urls: null,
      requested,
    };
  }

  const r = resolveDeepLink(search, registry);

  const retired = (r.ignored || []).filter((i) => i.param === 'sim');
  const retiredNotice = retired.length
    ? 'The ?sim= spelling is retired — use ?simulation= instead. (The link was still read as a world link.)'
    : null;

  if (r.ok) {
    const out = {
      action: r.kind,
      world: r.world,
      target: r.kind === 'world' ? null : (r[r.kind] || null),
      error: null,
      notice: null,
      retiredNotice,
      ignored: r.ignored || [],
      urls: r.urls || null,
      requested,
    };
    return out;
  }

  // Failure. When the world itself was valid, fall back to the world
  // view and say what was not found (the plan's fallback pattern).
  if (r.world) {
    const paramName = r.param || 'target';
    const wanted = r.requested && r.requested[paramName] ? r.requested[paramName] : '';
    const notice = wanted
      ? `No ${paramName} “${wanted}” in ${r.world.name} — showing the world instead.`
      : `That ${paramName} was not found in ${r.world.name} — showing the world instead.`;
    return {
      action: 'world',
      world: r.world,
      target: null,
      error: r.error,
      notice,
      retiredNotice,
      ignored: r.ignored || [],
      urls: null,
      requested,
    };
  }

  if (r.error === 'missing_world') {
    return {
      action: 'no-world',
      world: null,
      target: null,
      error: r.error,
      notice: null,
      retiredNotice,
      ignored: r.ignored || [],
      urls: null,
      requested,
    };
  }

  // world_not_found / malformed world / bad_registry: no world to fall
  // back to — the caller shows its unknown-world / lobby path.
  return {
    action: 'unknown-world',
    world: null,
    target: null,
    error: r.error,
    notice: null,
    retiredNotice,
    ignored: r.ignored || [],
    urls: null,
    requested,
  };
}
