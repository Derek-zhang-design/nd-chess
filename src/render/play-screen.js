// Play screen: Black's piece table on the left, White's on the right,
// and threat arrows drawn across the gap between them.
//
// Threat colours are from the point of view of the player to move:
//   red  ("danger")  an arrow into one of their pieces: they are being threatened
//   grey ("attack")  an arrow from one of their pieces: they are threatening
// A threatened row's outline uses the same colour and emphasis as its arrows.

import { h, svg } from './dom.js';
import { WHITE, BLACK, parseKey } from '../engine/index.js';
import {
  SHOW_PIECE_ICONS, axisName, colorName, comparePieces, pieceLabel, pieceSymbol,
} from './labels.js';

// Arrowhead length in screen pixels (SVG user units), by emphasis.
const HEAD_LENGTH = { strong: 9, soft: 7, dim: 7 };
const KINDS = ['danger', 'attack'];
const EMPHASES = ['dim', 'soft', 'strong'];

// When a row both sends and receives arrows, outgoing arrows leave above its
// centre and incoming ones arrive below, this fraction of the row height apart.
const NODE_OFFSET = 0.22;

// The marker is anchored at the middle of the triangle's base (refX 0), and each
// line stops HEAD_LENGTH short of the target. The triangle then continues the line
// instead of sitting on top of it.
function arrowHead(kind, emphasis) {
  const length = HEAD_LENGTH[emphasis];
  return svg('marker', {
    id: `arrow-head-${kind}-${emphasis}`,
    viewBox: '0 0 10 10',
    refX: '0',
    refY: '5',
    markerUnits: 'userSpaceOnUse',
    markerWidth: String(length),
    markerHeight: String(length),
    orient: 'auto',
  }, svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: `arrow-head arrow-${kind} is-${emphasis}` }));
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

  // Red if the target belongs to the player to move, grey if they're the attacker.
  function kindOf(targetId) {
    return colorById.get(targetId) === state.game.turn ? 'danger' : 'attack';
  }

  // Bold for the hovered or pinned piece's arrows, dim for the rest while something
  // is highlighted, and soft when nothing is.
  function emphasisOf(focus, ids) {
    if (focus === null) return 'soft';
    return ids.includes(focus) ? 'strong' : 'dim';
  }

  // Outlines and arrows are restyled here, not in renderSide, so hovering doesn't rebuild the tables.
  function drawArrows() {
    if (!state || !element.isConnected) return;
    const { threats, focusId, arrowsHidden } = state;
    const focus = hoverId ?? focusId ?? null;

    for (const row of element.querySelectorAll('tr.is-focus')) row.classList.remove('is-focus');
    if (focus) rowFor(focus)?.classList.add('is-focus');

    drawOutlines(threats, focus);

    arrows.replaceChildren(svg('defs', {},
      KINDS.flatMap((kind) => EMPHASES.map((emphasis) => arrowHead(kind, emphasis)))));
    if (arrowsHidden) return;

    const box = element.getBoundingClientRect();
    const blackEdge = scrollers[BLACK].getBoundingClientRect().right - box.left;
    const whiteEdge = scrollers[WHITE].getBoundingClientRect().left - box.left;

    const sends = new Set(threats.map((t) => t.attackerId));
    const receives = new Set(threats.map((t) => t.targetId));
    const nodeY = (id, role) => {
      const row = rowFor(id);
      if (!row) return null;
      const r = row.getBoundingClientRect();
      const center = r.top + r.height / 2 - box.top;
      if (!(sends.has(id) && receives.has(id))) return center;
      const offset = r.height * NODE_OFFSET;
      return role === 'out' ? center - offset : center + offset;
    };

    const layers = { dim: [], soft: [], strong: [] };
    for (const { attackerId, targetId } of threats) {
      const y1 = nodeY(attackerId, 'out');
      const y2 = nodeY(targetId, 'in');
      if (y1 === null || y2 === null) continue;

      const kind = kindOf(targetId);
      const emphasis = emphasisOf(focus, [attackerId, targetId]);
      const fromBlack = colorById.get(attackerId) === BLACK;
      const direction = fromBlack ? 1 : -1;
      const x1 = fromBlack ? blackEdge + 2 : whiteEdge - 2;
      const tip = fromBlack ? whiteEdge - 4 : blackEdge + 4;
      // The curve ends flat, so the head points straight at the target row.
      const x2 = tip - direction * HEAD_LENGTH[emphasis];
      const mid = (x1 + x2) / 2;

      layers[emphasis].push(svg('path', {
        d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
        class: `arrow arrow-${kind} is-${emphasis}`,
        'marker-end': `url(#arrow-head-${kind}-${emphasis})`,
      }));
    }
    arrows.append(...layers.dim, ...layers.soft, ...layers.strong);
  }

  // A threatened row is outlined in its arrows' colour. It's bold when the focus is
  // the row itself or any piece attacking it.
  function drawOutlines(threats, focus) {
    const attackersOf = new Map();
    for (const { attackerId, targetId } of threats) {
      if (!attackersOf.has(targetId)) attackersOf.set(targetId, []);
      attackersOf.get(targetId).push(attackerId);
    }
    for (const row of element.querySelectorAll('tr.piece-row')) {
      const id = row.dataset.pieceId;
      const attackers = attackersOf.get(id);
      if (!attackers) {
        delete row.dataset.threat;
        delete row.dataset.emphasis;
        continue;
      }
      row.dataset.threat = kindOf(id);
      row.dataset.emphasis = emphasisOf(focus, [id, ...attackers]);
    }
  }

  return { element, update };
}
