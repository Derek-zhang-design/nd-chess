// Public engine API. Pure JS: must not touch the DOM.

export { keyOf, parseKey } from './coords.js';
export { createConfig, DEFAULT_DIMENSIONS, DEFAULT_AXIS_SIZE } from './config.js';
export {
  WHITE, BLACK, KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN, PROMOTION_TYPES, opponent,
} from './pieces.js';
export { attacks, pawnForward } from './movement.js';
export { createGame, findPiece, getMoves, applyMove, getThreats } from './game.js';
