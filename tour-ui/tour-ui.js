// tour-ui.js — guided-tour panel component (STAGED FIX, next-repairs BUG-3b).
// Based on deep-interop-build/next-debug/fixes/BUG-3-tour-ui.js (the BUG-3
// fix: setStep() returns early after destroy()). This file adds the same
// guard to the four button handlers in bind() (Start / Previous / Next /
// step-click), which also call saveStep() before render(). After destroy()
// the panel element is detached, so a user cannot click those buttons —
// but a stale reference can still dispatch a click on the detached
// element, and the old handlers wrote localStorage before render()'s
// guard ran. With these guards no post-destroy path writes storage.
// Everything else is identical to the BUG-3 staged fix.
// A panel that shows a tour's name, its steps in order, the current
// step, and Start / Previous / Next / End controls.
//
// A tour IS a quest (DEEP_LINK_CONTRACT.md v1): the `quest` passed in is
// the registry quest object the deep-link reader resolved — title,
// description, reward, and steps[] (each step: kind, target, text).
// No quest or step is invented here; every line shown is copied from
// the quest.
//
// This panel is a GUIDE, not a grader. It shows the steps in order and
// remembers which step you are looking at (Next / Previous). Whether a
// step is actually done in the world — talking to an NPC, collecting an
// item, visiting a place — is tracked by the player's own quest system
// (the static engine's quest state, or the IWSDK QuestSystem's tracker
// and gold beacon), not by this panel. The panel says so plainly.
//
// Usage (ES module, DOM only, no fetch, no imports):
//   import { createTourUI } from '../tour-ui/tour-ui.js';
//   const ui = createTourUI(hostElement, quest, world, {
//     onEnd: () => { /* restore the previous panel content */ },
//   });
//   ui.destroy(); // removes the panel and its listeners.
//
// Progress (which step is showing) is kept in memory and in
// localStorage under `w3d-tour-<worldId>-<questId>` so reopening the
// tour resumes where you left off. Closing with End keeps the saved
// step; Start begins again at step 1.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stepVerb(kind) {
  if (kind === 'npc') return 'Talk to';
  if (kind === 'collectible') return 'Collect';
  if (kind === 'place') return 'Visit';
  if (kind === 'position') return 'Go to';
  return 'Do';
}

function storageKey(worldId, questId) {
  return 'w3d-tour-' + worldId + '-' + questId;
}

function loadStep(worldId, questId) {
  try {
    const raw = localStorage.getItem(storageKey(worldId, questId));
    const n = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (e) {
    return 0;
  }
}

function saveStep(worldId, questId, idx) {
  try {
    localStorage.setItem(storageKey(worldId, questId), String(idx));
  } catch (e) {
    // Private mode / storage off: the panel still works in memory.
  }
}

export function createTourUI(host, quest, world, opts) {
  opts = opts || {};
  const worldId = (world && world.id) || (quest && quest.world_id) || '';
  const steps = (quest && Array.isArray(quest.steps)) ? quest.steps : [];
  let current = Math.min(loadStep(worldId, quest.id), Math.max(steps.length - 1, 0));
  let started = current > 0;
  let destroyed = false;

  const el = document.createElement('div');
  el.className = 'tour-ui';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Guided tour: ' + (quest.title || quest.id));

  function render() {
    if (destroyed) return;
    const total = steps.length;
    const step = total ? steps[current] : null;
    const pct = total ? Math.round(((current + 1) / total) * 100) : 0;
    el.innerHTML = '<button type="button" class="tour-ui-back" data-tour-ui="back">← Back to world info</button>'
      + '<h2 class="tour-ui-title">🧭 ' + esc(quest.title || quest.id) + '</h2>'
      + '<p class="tour-ui-kind">Guided tour · ' + esc(world ? (world.name || worldId) : worldId)
      + ' · ' + total + ' step' + (total === 1 ? '' : 's') + '</p>'
      + (quest.description ? '<p>' + esc(quest.description) + '</p>' : '')
      + (quest.reward ? '<p class="tour-ui-reward">Reward: ' + esc(quest.reward) + '</p>' : '')
      + '<ol class="tour-ui-steps">'
      + steps.map(function (s, i) {
        const cls = i === current ? 'tour-ui-current' : (i < current ? 'tour-ui-seen' : '');
        return '<li class="' + cls + '" data-tour-ui-step="' + i + '">'
          + '<span class="tour-ui-step-num">' + (i + 1) + '</span> '
          + '<span class="tour-ui-step-verb">' + esc(stepVerb(s.kind)) + '</span> '
          + '<strong>' + esc(s.target || '') + '</strong>'
          + '<br><span class="tour-ui-step-text">' + esc(s.text || '') + '</span></li>';
      }).join('')
      + '</ol>'
      + (step
        ? '<p class="tour-ui-now"><strong>Now:</strong> ' + esc(step.text || '') + '</p>'
          + '<p class="tour-ui-progress">Step ' + (current + 1) + ' of ' + total + ' · ' + pct + '% through the list</p>'
        : '<p class="tour-ui-now">This tour has no steps listed.</p>')
      + '<div class="tour-ui-btns">'
      + '<button type="button" data-tour-ui="start">' + (started ? '↺ Restart tour' : '▶ Start tour') + '</button> '
      + '<button type="button" data-tour-ui="prev"' + (current <= 0 ? ' disabled' : '') + '>← Previous</button> '
      + '<button type="button" data-tour-ui="next"' + (current >= total - 1 ? ' disabled' : '') + '>Next →</button> '
      + '<button type="button" data-tour-ui="end">End tour</button>'
      + '</div>'
      + '<p class="tour-ui-note">This panel is your guide — it shows the steps in order. '
      + 'A step is done when you do it in the world (talk to the NPC, collect the item, '
      + 'visit the place); the player’s own quest tracker keeps that record, not this panel.</p>';
    bind();
  }

  function bind() {
    const q = function (sel) { return el.querySelector(sel); };
    const back = q('[data-tour-ui="back"]');
    if (back) back.addEventListener('click', function () { end(); });
    const start = q('[data-tour-ui="start"]');
    if (start) start.addEventListener('click', function () {
      if (destroyed) return;
      started = true;
      current = 0;
      saveStep(worldId, quest.id, current);
      render();
    });
    const prev = q('[data-tour-ui="prev"]');
    if (prev) prev.addEventListener('click', function () {
      if (destroyed) return;
      if (current > 0) { current--; saveStep(worldId, quest.id, current); render(); }
    });
    const next = q('[data-tour-ui="next"]');
    if (next) next.addEventListener('click', function () {
      if (destroyed) return;
      if (current < steps.length - 1) { current++; saveStep(worldId, quest.id, current); render(); }
    });
    const endBtn = q('[data-tour-ui="end"]');
    if (endBtn) endBtn.addEventListener('click', function () { end(); });
    el.querySelectorAll('[data-tour-ui-step]').forEach(function (li) {
      li.addEventListener('click', function () {
        if (destroyed) return;
        const i = parseInt(li.getAttribute('data-tour-ui-step'), 10);
        if (Number.isFinite(i) && i >= 0 && i < steps.length) {
          current = i;
          saveStep(worldId, quest.id, current);
          render();
        }
      });
    });
  }

  function end() {
    if (destroyed) return;
    destroyed = true;
    if (el.parentNode) el.parentNode.removeChild(el);
    if (typeof opts.onEnd === 'function') opts.onEnd();
  }

  render();
  host.appendChild(el);

  return {
    el,
    get current() { return current; },
    get total() { return steps.length; },
    setStep(i) {
      if (destroyed) return;
      if (Number.isFinite(i) && i >= 0 && i < steps.length) {
        current = i;
        saveStep(worldId, quest.id, current);
        render();
      }
    },
    destroy() { end(); },
  };
}
