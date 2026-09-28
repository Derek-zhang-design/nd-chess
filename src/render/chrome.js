// Shared page chrome: the top bar, the bottom action area, buttons, and the winner popup.

import { h } from './dom.js';
import { opponent } from '../engine/index.js';
import { colorName } from './labels.js';

export function renderTopBar(el, game) {
  const side = game.winner ?? game.turn;
  const status = game.winner ? `${colorName(game.winner)} wins` : `${colorName(game.turn)} to move`;
  el.replaceChildren(
    h('span', { class: 'top-title' }, `${game.shape.length}D Chess`),
    h('span', { class: 'turn' },
      h('span', { class: `swatch swatch-${side}`, 'aria-hidden': 'true' }),
      status,
    ),
  );
  el.hidden = false;
}

export function hideTopBar(el) {
  el.replaceChildren();
  el.hidden = true;
}

// Every confirming action goes in the bottom action area.
export function setActions(el, items) {
  el.replaceChildren(...items);
  el.hidden = items.length === 0;
}

export function button(label, { primary = false, onClick } = {}) {
  return h('button', { type: 'button', class: primary ? 'btn btn-primary' : 'btn', onClick }, label);
}

export function actionHint(text) {
  return h('span', { class: 'action-hint' }, text);
}

export function winnerCard(game) {
  const moves = game.history.length;
  return h('section', { class: 'winner', role: 'alertdialog', 'aria-labelledby': 'winner-title' },
    h('h2', { class: 'winner-title', id: 'winner-title' }, `${colorName(game.winner)} wins!`),
    h('p', { class: 'winner-detail' },
      `${colorName(opponent(game.winner))}'s king was captured after ${moves} ${moves === 1 ? 'move' : 'moves'}.`),
  );
}
