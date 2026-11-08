/* explore-hover.js — STAGED hover implementation for the static explore/player
   pages (next-wiring/f-hover/, 2026-11-07). Built on the Phase E-A prototype
   (phase-e/hover-a1/hover-prototype.js + hover-prototype.css) and the spec
   (phase-e/hover-a1/HOVER_SPEC.md). STAGED ONLY: nothing here is wired into
   explore.html, player.html, or any live file. Do not copy in without Mike's
   decision on hover A-1 (HOVER_SPEC.md §9: approve / approve with changes /
   reject; 350 ms tooltip dwell; hall hover scope).

   What changed vs the prototype (deliberate, spec-driven):
   1. Tooltip dwell (spec §4.3): the highlight applies on hover-in within
      one frame, but the tooltip appears only after a 350 ms dwell on the
      same object (DEFAULT_TOOLTIP_DELAY_MS). Hover-out clears the pending
      tooltip immediately. The prototype showed the tooltip synchronously;
      this file implements the spec timing. The 350 ms value is itself a
      sub-decision (keep / shorten / drop the tooltip) — pass
      { tooltipDelayMs } to override; 0 restores the prototype's
      near-synchronous tooltip.
   2. Explore wiring: annotateExplorePanel() maps the explore.js list
      buttons to hover kinds — [data-station] -> 'station' ("<name> — Open"),
      [data-simulation] -> 'sim-seat' ("<title> — Run sim") — using the
      spec §4.2 labels. Step buttons, Reset, Back, and teleport buttons are
      controls, not hoverable objects under the spec, and are left alone.
      explore.js re-renders the panel on every navigation (innerHTML), so
      initExploreHover() re-annotates on panel mutations (MutationObserver,
      guarded) and exposes annotateExplorePanel() for explicit re-runs.
   3. The 3D side is NOT in this file: IWSDK hover belongs on the `Hovered`
      subscription (HOVER_SPEC.md §7) and is a separate build pass.

   Palette and rules are unchanged from the prototype: the four sourced
   hexes only (purple #7a5fd0, teal #2f9a8a, cyan #19b8c4, amber #d98a1f),
   brightness lift + per-kind outline, no invented colours, no layout
   shift, keyboard focus mirrors hover, hover never performs the action. */
(function (root) {
  'use strict';

  var HOVER_CLASS = 'w3d-hover';
  var TIP_ID = 'w3d-hover-tip';
  var TIP_HIDDEN_CLASS = 'w3d-tip--hidden';
  var DEFAULT_TOOLTIP_DELAY_MS = 350; // HOVER_SPEC.md §4.3 (proposed — decision item)

  /* The ten hoverable kinds. Anything else (including "none") gets no hover. */
  var HOVERABLE_KINDS = [
    'npc-quest', 'advisor', 'sim-seat', 'hall', 'vehicle',
    'collectible', 'station', 'door', 'exit-pad', 'prop-info'
  ];

  function kindClass(kind) { return 'w3d-hover--' + kind; }
  function isHoverable(kind) { return HOVERABLE_KINDS.indexOf(kind) !== -1; }

  function labelFor(el) {
    var label = null;
    if (typeof el.getAttribute === 'function') label = el.getAttribute('data-hover-label');
    if (label) return label;
    if (typeof el.getAttribute === 'function') label = el.getAttribute('aria-label');
    if (label) return label;
    var text = '';
    if (typeof el.textContent === 'string') text = el.textContent;
    text = text.replace(/^\s+|\s+$/g, '');
    return text || '';
  }

  function getTooltip(doc) {
    var tip = null;
    if (doc && typeof doc.getElementById === 'function') tip = doc.getElementById(TIP_ID);
    if (tip) return tip;
    if (doc && typeof doc.createElement === 'function') {
      tip = doc.createElement('div');
      tip.setAttribute('id', TIP_ID);
      tip.setAttribute('role', 'status');
      if (tip.classList && tip.classList.add) tip.classList.add(TIP_HIDDEN_CLASS);
      var body = (doc && doc.body) || null;
      if (body && typeof body.appendChild === 'function') body.appendChild(tip);
    }
    return tip;
  }

  function showTip(doc, label) {
    var tip = getTooltip(doc);
    if (!tip) return;
    if (typeof tip.textContent !== 'undefined') tip.textContent = label;
    if (tip.classList && tip.classList.remove) tip.classList.remove(TIP_HIDDEN_CLASS);
    if (typeof tip.setAttribute === 'function') tip.setAttribute('aria-hidden', 'false');
  }

  function hideTip(doc) {
    var tip = null;
    if (doc && typeof doc.getElementById === 'function') tip = doc.getElementById(TIP_ID);
    if (!tip) return;
    if (tip.classList && tip.classList.add) tip.classList.add(TIP_HIDDEN_CLASS);
    if (typeof tip.setAttribute === 'function') tip.setAttribute('aria-hidden', 'true');
  }

  function hoverIn(doc, el, kind, delayMs) {
    if (el.classList) { el.classList.add(HOVER_CLASS); el.classList.add(kindClass(kind)); }
    var label = labelFor(el);
    if (!label) return;
    /* Tooltip dwell (spec §4.3): the highlight is immediate; the tooltip
       waits out the dwell on the same object. A pending tooltip is
       cancelled by hover-out (see hoverOut). */
    var delay = (typeof delayMs === 'number' && delayMs >= 0) ? delayMs : DEFAULT_TOOLTIP_DELAY_MS;
    if (typeof setTimeout === 'function' && delay > 0) {
      if (el.__w3dTipTimer) clearTimeout(el.__w3dTipTimer);
      el.__w3dTipTimer = setTimeout(function () { el.__w3dTipTimer = null; showTip(doc, label); }, delay);
    } else {
      showTip(doc, label);
    }
  }

  function hoverOut(doc, el, kind) {
    if (el.__w3dTipTimer && typeof clearTimeout === 'function') { clearTimeout(el.__w3dTipTimer); el.__w3dTipTimer = null; }
    if (el.classList) { el.classList.remove(HOVER_CLASS); el.classList.remove(kindClass(kind)); }
    hideTip(doc);
  }

  /* Attach hover/focus handling to every [data-hover-kind] element under root.
     root is a Document (or any node with querySelectorAll). Returns a handle
     with destroy() and the count of hoverable elements bound. */
  function initW3dHover(root, opts) {
    var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
    var scope = root || doc;
    if (!scope || typeof scope.querySelectorAll !== 'function') return { count: 0, destroy: function () {} };
    var options = opts || {};
    var delayMs = (typeof options.tooltipDelayMs === 'number') ? options.tooltipDelayMs : DEFAULT_TOOLTIP_DELAY_MS;
    var nodes = scope.querySelectorAll('[data-hover-kind]');
    var bound = [];
    function eachNode(fn) {
      for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
    }
    eachNode(function (el) {
      var kind = (typeof el.getAttribute === 'function') ? el.getAttribute('data-hover-kind') : null;
      if (!isHoverable(kind)) return; /* "none" and unknown kinds: no hover, by design */
      var onIn = function () { hoverIn(doc, el, kind, delayMs); };
      var onOut = function () { hoverOut(doc, el, kind); };
      el.addEventListener('mouseenter', onIn);
      el.addEventListener('mouseleave', onOut);
      el.addEventListener('focus', onIn); /* keyboard focus is hover (spec §4.4) */
      el.addEventListener('blur', onOut);
      bound.push({ el: el, onIn: onIn, onOut: onOut });
    });
    return {
      count: bound.length,
      kinds: HOVERABLE_KINDS.slice(),
      destroy: function () {
        bound.forEach(function (b) {
          if (b.el.__w3dTipTimer && typeof clearTimeout === 'function') { clearTimeout(b.el.__w3dTipTimer); b.el.__w3dTipTimer = null; }
          b.el.removeEventListener('mouseenter', b.onIn);
          b.el.removeEventListener('mouseleave', b.onOut);
          b.el.removeEventListener('focus', b.onIn);
          b.el.removeEventListener('blur', b.onOut);
        });
        bound.length = 0;
      }
    };
  }

  /* ---- Explore wiring (static explore/player pages) ----
     explore.js renders its station/sim lists as buttons:
       renderList(): <button class="xpl-go" data-station="<id>">Name</button>
                     <button class="xpl-go" data-simulation="<id>">Title</button>
     Annotate exactly those two button kinds. Labels follow HOVER_SPEC.md §4.2
     verbatim: station "<name> — Open", sim "<title> — Run sim". Buttons for
     steps, Reset, Back, and teleport are controls, not hoverable objects,
     and are left unannotated. Idempotent: an element that already carries
     data-hover-kind is never overwritten. Returns the count annotated. */
  function annotateExplorePanel(host) {
    if (!host || typeof host.querySelectorAll !== 'function') return 0;
    var count = 0;
    function annotate(sel, kind, verb) {
      var nodes = host.querySelectorAll(sel);
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (typeof el.getAttribute !== 'function') continue;
        if (el.getAttribute('data-hover-kind')) continue;
        var name = (typeof el.textContent === 'string') ? el.textContent.replace(/^\s+|\s+$/g, '') : '';
        if (!name) continue;
        el.setAttribute('data-hover-kind', kind);
        el.setAttribute('data-hover-label', name + ' — ' + verb);
        count++;
      }
    }
    annotate('button[data-station]', 'station', 'Open');
    annotate('button[data-simulation]', 'sim-seat', 'Run sim');
    return count;
  }

  /* Full staged wiring for an explore page: annotate the panel, bind hover,
     and re-annotate when explore.js re-renders the panel (it replaces
     innerHTML on every navigation). Returns the initW3dHover handle plus
     the annotate count and a disconnect() for the observer. */
  function initExploreHover(root, opts) {
    var doc = (root && root.ownerDocument) || root || (typeof document !== 'undefined' ? document : null);
    var scope = root || doc;
    var annotated = annotateExplorePanel(scope);
    var handle = initW3dHover(scope, opts);
    var observer = null;
    var MO = (typeof MutationObserver !== 'undefined') ? MutationObserver : null;
    if (MO && scope && typeof scope.querySelectorAll === 'function') {
      var panel = null;
      if (typeof scope.getElementById === 'function') panel = scope.getElementById('explore-panel');
      var target = panel || scope;
      try {
        observer = new MO(function () {
          var added = annotateExplorePanel(scope);
          if (added) { /* new buttons need binding: re-run init for them */ initW3dHover(scope, opts); }
        });
        if (typeof observer.observe === 'function') observer.observe(target, { childList: true, subtree: true });
      } catch (e) { observer = null; }
    }
    return {
      count: handle.count,
      annotated: annotated,
      kinds: handle.kinds,
      destroy: function () {
        if (observer && typeof observer.disconnect === 'function') observer.disconnect();
        handle.destroy();
      }
    };
  }

  var api = {
    initW3dHover: initW3dHover,
    initExploreHover: initExploreHover,
    annotateExplorePanel: annotateExplorePanel,
    HOVERABLE_KINDS: HOVERABLE_KINDS.slice(),
    DEFAULT_TOOLTIP_DELAY_MS: DEFAULT_TOOLTIP_DELAY_MS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.W3D_EXPLORE_HOVER = api;

  /* Browser auto-init: run once the DOM is ready. No-op under node. */
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    var boot = function () { initExploreHover(document); };
    if (document.readyState === 'loading' && document.addEventListener) {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
