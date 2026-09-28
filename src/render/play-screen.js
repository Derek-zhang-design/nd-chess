// Play screen: Black's piece table on the left, White's on the right,
// and threat arrows drawn across the gap between them.

import { h, svg } from './dom.js';
import { WHITE, BLACK, parseKey } from '../engine/index.js';
import {
  SHOW_PIECE_ICONS, axisName, colorName, comparePieces, pieceLabel, pieceSymbol,
} from './labels.js';

// Arrowhead length in screen pixels (SVG user units), for faint and highlighted arrows.
const HEAD_LENGTH = { faint: 7, focus: 9 };

// The marker is anchored at the middle of the triangle's base (refX 0), and each
// line stops HEAD_LENGTH short of the target. The triangle then continues the line
// instead of sitting on top of it, so nothing shows through a translucent head.
function arrowHead(id, className, length) {
  return svg('marker', {
    id,
    viewBox: '0 0 10 10',
    refX: '0',
    refY: '5',
    markerUnits: 'userSpaceOnUse',
    markerWidth: String(length),
    markerHeight: String(length),
    orient: 'auto',
  }, svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: className }));
}

export function createPlayScreen({ onPieceClick }) {
  const collapsed = { [BLACK]: false, [WHITE]: false };
  const sections = {};
  const scrollers = {};
  for (const color of [BLACK, WHITE]) {
    sections[color] = h('section', { class: `side side-${color}`, 'aria-label': `${colorName(color)} pieces` });
  }
  const arrows = svg('svg', { class: 'arrows', 'aria-hidden': 'true' });
  const element = h('div', { class: 'play' }, sections[BLACK], h('div', { class: 'gutter' }), sections[WHITE], arrows);

  // state: { game, threats, selectedId, focusId, arrowsHidden }
  let state = null;
  let colorById = new Map();
  let hoverId = null;

  new ResizeObserver(() => drawArrows()).observe(element);

  function update(next) {
    state = next;
    colorById = new Map([...state.game.pieces.values()].map((p) => [p.id, p.color]));
    renderSide(BLACK);
    renderSide(WHITE);
    drawArrows();
  }

  function renderSide(color) {
    const { game, threats, selectedId } = state;
    const threatened = new Set(threats.map((t) => t.targetId));
    const isTurn = !game.winner && game.turn === color;

    const live = [];
    for (const [key, piece] of game.pieces) {
      if (piece.color === color) live.push({ piece, pos: parseKey(key) });
    }
    live.sort((a, b) => comparePieces(a.piece, b.piece));
    const captured = game.captured.filter((p) => p.color === color).sort(comparePieces);

    const table = h('table', { class: `pieces${collapsed[color] ? ' is-collapsed' : ''}` },
      h('thead', {},
        h('tr', {},
          h('th', { class: 'name', scope: 'col' }, 'Piece'),
          game.shape.map((_, axis) => h('th', { class: 'coord', scope: 'col' }, axisName(axis))),
        ),
      ),
      h('tbody', {},
        live.map(({ piece, pos }) => pieceRow(piece, pos, {
          selectable: isTurn,
          threatened: threatened.has(piece.id),
          selected: piece.id === selectedId,
        })),
        captured.map((piece) => pieceRow(piece, null, { captured: true })),
      ),
    );
    scrollers[color] = h('div', { class: `table-scroll theme-${color}` }, table);

    const toggle = h('button', {
      type: 'button',
      class: 'link-button',
      'aria-expanded': String(!collapsed[color]),
      onClick: () => {
        collapsed[color] = !collapsed[color];
        renderSide(color);
        drawArrows();
      },
    }, collapsed[color] ? 'Show coordinates' : 'Hide coordinates');

    sections[color].classList.toggle('is-turn', isTurn);
    sections[color].replaceChildren(
      h('header', { class: 'side-header' },
        h('h2', { class: 'side-title' },
          h('span', { class: `swatch swatch-${color}`, 'aria-hidden': 'true' }),
          colorName(color),
          isTurn && h('span', { class: 'turn-badge' }, 'to move'),
        ),
        toggle,
      ),
      scrollers[color],
    );
  }

  function pieceRow(piece, pos, { selectable = false, threatened = false, selected = false, captured = false }) {
    const classes = [
      'piece-row',
      selectable && 'is-selectable',
      threatened && 'is-threatened',
      selected && 'is-selected',
      captured && 'is-captured',
    ].filter(Boolean).join(' ');

    const label = h('span', { class: 'piece-name' },
      SHOW_PIECE_ICONS && h('span', { class: 'symbol', 'aria-hidden': 'true' }, pieceSymbol(piece)),
      pieceLabel(piece),
      threatened && h('span', { class: 'visually-hidden' }, ' (under attack)'),
      captured && h('span', { class: 'visually-hidden' }, ' (captured)'),
    );
    const name = h('th', { class: 'name', scope: 'row' },
      captured ? label : h('button', { type: 'button', class: 'piece-button' }, label));
    const cells = pos
      ? pos.map((v) => h('td', { class: 'coord' }, String(v + 1)))
      : state.game.shape.map(() => h('td', { class: 'coord' }, '—'));

    const row = h('tr', { class: classes, dataset: { pieceId: piece.id } }, name, cells);
    if (!captured) {
      row.addEventListener('click', () => onPieceClick(piece.id));
      row.addEventListener('mouseenter', () => {
        hoverId = piece.id;
        drawArrows();
      });
      row.addEventListener('mouseleave', () => {
        if (hoverId !== piece.id) return;
        hoverId = null;
        drawArrows();
      });
    }
    return row;
  }

  function rowFor(id) {
    return element.querySelector(`tr[data-piece-id="${id}"]`);
  }

  // Arrows run from the attacker's row to the target's row, across the gap.
  // They're faint by default; the hovered or pinned piece's arrows are bold and the rest dim.
  function drawArrows() {
    if (!state || !element.isConnected) return;
    const { threats, focusId, arrowsHidden } = state;
    const focus = hoverId ?? focusId ?? null;

    for (const row of element.querySelectorAll('tr.is-focus')) row.classList.remove('is-focus');
    if (focus) rowFor(focus)?.classList.add('is-focus');

    arrows.replaceChildren(svg('defs', {},
      arrowHead('arrow-head', 'arrow-head', HEAD_LENGTH.faint),
      arrowHead('arrow-head-focus', 'arrow-head is-focus', HEAD_LENGTH.focus),
    ));
    if (arrowsHidden) return;

    const box = element.getBoundingClientRect();
    const blackEdge = scrollers[BLACK].getBoundingClientRect().right - box.left;
    const whiteEdge = scrollers[WHITE].getBoundingClientRect().left - box.left;
    const rowY = (id) => {
      const row = rowFor(id);
      if (!row) return null;
      const r = row.getBoundingClientRect();
      return r.top + r.height / 2 - box.top;
    };

    const faint = [];
    const strong = [];
    for (const { attackerId, targetId } of threats) {
      const y1 = rowY(attackerId);
      const y2 = rowY(targetId);
      if (y1 === null || y2 === null) continue;

      const fromBlack = colorById.get(attackerId) === BLACK;
      const direction = fromBlack ? 1 : -1;
      const isFocus = focus !== null && (focus === attackerId || focus === targetId);
      const x1 = fromBlack ? blackEdge + 2 : whiteEdge - 2;
      const tip = fromBlack ? whiteEdge - 4 : blackEdge + 4;
      // The curve ends flat, so the head points straight at the target row.
      const x2 = tip - direction * (isFocus ? HEAD_LENGTH.focus : HEAD_LENGTH.faint);
      const mid = (x1 + x2) / 2;

      const path = svg('path', {
        d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
        class: `arrow${isFocus ? ' is-focus' : focus ? ' is-dim' : ''}`,
        'marker-end': `url(#${isFocus ? 'arrow-head-focus' : 'arrow-head'})`,
      });
      (isFocus ? strong : faint).push(path);
    }
    arrows.append(...faint, ...strong);
  }

  return { element, update };
}
