// Movement rules: generating a piece's moves, and testing whether one piece attacks a square.
// Direction lists grow with N² at most, never 3^N (see "Performance rules" in CLAUDE.md).

import { keyOf, inBounds, offset, differences } from './coords.js';
import { WHITE, KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN } from './pieces.js';

const SIGNS = [1, -1];

// Direction lists depend only on the number of axes, so cache them per N.
const directionCache = new Map();

function directionsFor(n) {
  if (directionCache.has(n)) return directionCache.get(n);

  const straight = [];
  for (let axis = 0; axis < n; axis++) {
    for (const sign of SIGNS) straight.push([{ axis, delta: sign }]);
  }

  const diagonal = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (const sa of SIGNS) {
        for (const sb of SIGNS) diagonal.push([{ axis: a, delta: sa }, { axis: b, delta: sb }]);
      }
    }
  }

  const knight = [];
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      for (const sa of SIGNS) {
        for (const sb of SIGNS) knight.push([{ axis: a, delta: 2 * sa }, { axis: b, delta: sb }]);
      }
    }
  }

  const sets = { straight, diagonal, all: [...straight, ...diagonal], knight };
  directionCache.set(n, sets);
  return sets;
}

// Which way a pawn of `color` advances along `axis`: +1, -1, or 0 (never moves on d1).
export function pawnForward(color, axis) {
  if (axis === 0) return 0;
  if (axis === 1) return color === WHITE ? 1 : -1;
  return 1;
}

function scale(direction, steps) {
  return direction.map(({ axis, delta }) => ({ axis, delta: delta * steps }));
}

function makeMove(state, from, to, piece, changes, promotion = false) {
  const target = state.pieces.get(keyOf(to));
  return {
    from,
    to,
    pieceId: piece.id,
    captureId: target ? target.id : null,
    changes,
    promotion,
  };
}

function slide(state, from, piece, directions, maxSteps, moves) {
  for (const direction of directions) {
    for (let steps = 1; steps <= maxSteps; steps++) {
      const changes = scale(direction, steps);
      const to = offset(from, changes);
      if (!inBounds(state.shape, to)) break;
      const occupant = state.pieces.get(keyOf(to));
      if (occupant && occupant.color === piece.color) break;
      moves.push(makeMove(state, from, to, piece, changes));
      if (occupant) break;
    }
  }
}

function jump(state, from, piece, jumps, moves) {
  for (const changes of jumps) {
    const to = offset(from, changes);
    if (!inBounds(state.shape, to)) continue;
    const occupant = state.pieces.get(keyOf(to));
    if (occupant && occupant.color === piece.color) continue;
    moves.push(makeMove(state, from, to, piece, changes));
  }
}

function reachesEnd(shape, to, axis, forward) {
  return forward > 0 ? to[axis] === shape[axis] - 1 : to[axis] === 0;
}

function pawnMoves(state, from, piece, moves) {
  const { shape, pieces } = state;
  const isEmpty = (pos) => inBounds(shape, pos) && !pieces.has(keyOf(pos));

  for (let axis = 1; axis < shape.length; axis++) {
    const forward = pawnForward(piece.color, axis);

    const oneStep = [{ axis, delta: forward }];
    const one = offset(from, oneStep);
    if (isEmpty(one)) {
      moves.push(makeMove(state, from, one, piece, oneStep, reachesEnd(shape, one, axis, forward)));

      const twoStep = [{ axis, delta: 2 * forward }];
      const two = offset(from, twoStep);
      if (!piece.hasMoved && isEmpty(two)) {
        moves.push(makeMove(state, from, two, piece, twoStep, reachesEnd(shape, two, axis, forward)));
      }
    }

    // Capture: one step forward plus ±1 on d1 (option a).
    for (const side of SIGNS) {
      const changes = [{ axis: 0, delta: side }, { axis, delta: forward }];
      const to = offset(from, changes);
      if (!inBounds(shape, to)) continue;
      const occupant = pieces.get(keyOf(to));
      if (occupant && occupant.color !== piece.color) {
        moves.push(makeMove(state, from, to, piece, changes, reachesEnd(shape, to, axis, forward)));
      }
    }
  }
}

// All moves for the piece at `from`. Moves are not checked for king safety.
// Each move: { from, to, pieceId, captureId, changes: [{ axis, delta }], promotion }.
export function movesFrom(state, from) {
  const piece = state.pieces.get(keyOf(from));
  if (!piece) return [];

  const dirs = directionsFor(state.shape.length);
  const moves = [];
  switch (piece.type) {
    case ROOK: slide(state, from, piece, dirs.straight, Infinity, moves); break;
    case BISHOP: slide(state, from, piece, dirs.diagonal, Infinity, moves); break;
    case QUEEN: slide(state, from, piece, dirs.all, Infinity, moves); break;
    case KING: slide(state, from, piece, dirs.all, 1, moves); break;
    case KNIGHT: jump(state, from, piece, dirs.knight, moves); break;
    case PAWN: pawnMoves(state, from, piece, moves); break;
    default: throw new Error(`Unknown piece type: ${piece.type}`);
  }
  return moves;
}

// True if every square strictly between `from` and `from + diffs` is empty.
// `diffs` must describe a straight or equal-diagonal line.
function pathClear(state, from, diffs) {
  const steps = Math.abs(diffs[0].delta);
  const unit = diffs.map(({ axis, delta }) => ({ axis, delta: Math.sign(delta) }));
  for (let step = 1; step < steps; step++) {
    if (state.pieces.has(keyOf(offset(from, scale(unit, step))))) return false;
  }
  return true;
}

// Whether the piece at `from` attacks the square `to`, by geometry alone:
// it looks at which axes differ and by how much, then checks the path for blockers.
// It ignores what (if anything) stands on `to`.
export function attacks(state, from, to) {
  const piece = state.pieces.get(keyOf(from));
  if (!piece) return false;

  const diffs = differences(from, to, 2);
  if (!diffs || diffs.length === 0) return false;

  const straight = diffs.length === 1;
  const diagonal = diffs.length === 2 && Math.abs(diffs[0].delta) === Math.abs(diffs[1].delta);
  const oneStep = diffs.every(({ delta }) => Math.abs(delta) === 1);

  switch (piece.type) {
    case ROOK: return straight && pathClear(state, from, diffs);
    case BISHOP: return diagonal && pathClear(state, from, diffs);
    case QUEEN: return (straight || diagonal) && pathClear(state, from, diffs);
    case KING: return (straight || diagonal) && oneStep;
    case KNIGHT: {
      if (diffs.length !== 2) return false;
      const lengths = diffs.map(({ delta }) => Math.abs(delta)).sort();
      return lengths[0] === 1 && lengths[1] === 2;
    }
    case PAWN: {
      if (diffs.length !== 2 || diffs[0].axis !== 0 || Math.abs(diffs[0].delta) !== 1) return false;
      const { axis, delta } = diffs[1];
      return delta === pawnForward(piece.color, axis);
    }
    default: throw new Error(`Unknown piece type: ${piece.type}`);
  }
}
