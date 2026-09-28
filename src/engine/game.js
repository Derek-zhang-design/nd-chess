// Game state and turns. States are never mutated: applyMove returns a new one.

import { keyOf, parseKey, inBounds } from './coords.js';
import { createConfig } from './config.js';
import { WHITE, KING, PROMOTION_TYPES, opponent, standardPlacements } from './pieces.js';
import { movesFrom, attacks } from './movement.js';

// Options: everything createConfig accepts, plus
//   pieces  optional custom setup: [{ type, color, pos, hasMoved? }]. Defaults to the standard setup.
export function createGame(options = {}) {
  const config = createConfig(options);
  const placements = options.pieces ?? standardPlacements(config.shape);

  const pieces = new Map();
  const counts = {};
  for (const { type, color, pos, hasMoved = false } of placements) {
    if (pos.length !== config.shape.length || !inBounds(config.shape, pos)) {
      throw new Error(`Piece position [${pos}] is outside the board.`);
    }
    const key = keyOf(pos);
    if (pieces.has(key)) throw new Error(`Two pieces placed on [${pos}].`);

    const countKey = `${color}-${type}`;
    counts[countKey] = (counts[countKey] ?? 0) + 1;
    pieces.set(key, { id: `${countKey}-${counts[countKey]}`, type, color, hasMoved });
  }

  return {
    config,
    shape: config.shape,
    pieces,
    turn: WHITE,
    winner: null,
    captured: [],
    history: [],
  };
}

// Returns { pos, piece } for the piece with this id, or null if it's not on the board.
export function findPiece(state, id) {
  for (const [key, piece] of state.pieces) {
    if (piece.id === id) return { pos: parseKey(key), piece };
  }
  return null;
}

export function getMoves(state, from) {
  if (state.winner) return [];
  return movesFrom(state, from);
}

// Options:
//   promotion  piece type a promoting pawn becomes (default queen)
export function applyMove(state, move, { promotion = 'queen' } = {}) {
  if (state.winner) throw new Error('The game is over.');

  const fromKey = keyOf(move.from);
  const toKey = keyOf(move.to);
  const piece = state.pieces.get(fromKey);
  if (!piece) throw new Error(`No piece on [${move.from}].`);
  if (piece.color !== state.turn) throw new Error(`It is ${state.turn}'s turn.`);

  const legal = movesFrom(state, move.from).find((m) => keyOf(m.to) === toKey);
  if (!legal) throw new Error(`Illegal move: ${piece.id} from [${move.from}] to [${move.to}].`);
  if (legal.promotion && !PROMOTION_TYPES.includes(promotion)) {
    throw new Error(`Cannot promote to ${promotion}.`);
  }

  const pieces = new Map(state.pieces);
  const captured = state.captured.slice();
  const target = pieces.get(toKey);
  if (target) captured.push(target);

  pieces.delete(fromKey);
  pieces.set(toKey, {
    ...piece,
    type: legal.promotion ? promotion : piece.type,
    hasMoved: true,
  });

  // King capture: a side loses once it has no kings left, so this already
  // works if piece counts (and multiple kings) become configurable.
  let winner = null;
  if (target && target.type === KING && !hasKing(pieces, target.color)) winner = piece.color;

  return {
    ...state,
    pieces,
    captured,
    turn: opponent(state.turn),
    winner,
    history: [...state.history, { ...legal, promotedTo: legal.promotion ? promotion : null }],
  };
}

function hasKing(pieces, color) {
  for (const piece of pieces.values()) {
    if (piece.type === KING && piece.color === color) return true;
  }
  return false;
}

// Every enemy piece each piece currently attacks: [{ attackerId, targetId }].
// Uses geometry per pair of pieces, so the cost is pieces² × N, not board size.
export function getThreats(state) {
  const entries = [...state.pieces].map(([key, piece]) => ({ pos: parseKey(key), piece }));
  const threats = [];
  for (const attacker of entries) {
    for (const target of entries) {
      if (attacker.piece.color === target.piece.color) continue;
      if (attacks(state, attacker.pos, target.pos)) {
        threats.push({ attackerId: attacker.piece.id, targetId: target.piece.id });
      }
    }
  }
  return threats;
}
