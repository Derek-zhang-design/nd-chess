// Piece types, colours, and the default starting position.

import { MIN_STANDARD_D1, MIN_STANDARD_D2 } from './config.js';

export const WHITE = 'white';
export const BLACK = 'black';

export const KING = 'king';
export const QUEEN = 'queen';
export const ROOK = 'rook';
export const BISHOP = 'bishop';
export const KNIGHT = 'knight';
export const PAWN = 'pawn';

export const PROMOTION_TYPES = [QUEEN, ROOK, BISHOP, KNIGHT];

const BACK_RANK = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];

export function opponent(color) {
  return color === WHITE ? BLACK : WHITE;
}

// Standard chess on the d1 × d2 plane; every other axis at index 0.
// White fills the start of d2, Black the end.
export function standardPlacements(shape) {
  if (shape[0] < MIN_STANDARD_D1 || shape[1] < MIN_STANDARD_D2) {
    throw new Error(
      `The standard setup needs d1 ≥ ${MIN_STANDARD_D1} and d2 ≥ ${MIN_STANDARD_D2}, got ${shape[0]} × ${shape[1]}.`,
    );
  }

  const last = shape[1] - 1;
  const at = (d1, d2) => {
    const pos = Array(shape.length).fill(0);
    pos[0] = d1;
    pos[1] = d2;
    return pos;
  };

  const placements = [];
  BACK_RANK.forEach((type, file) => {
    placements.push({ type, color: WHITE, pos: at(file, 0) });
    placements.push({ type, color: BLACK, pos: at(file, last) });
  });
  for (let file = 0; file < MIN_STANDARD_D1; file++) {
    placements.push({ type: PAWN, color: WHITE, pos: at(file, 1) });
    placements.push({ type: PAWN, color: BLACK, pos: at(file, last - 1) });
  }
  return placements;
}
