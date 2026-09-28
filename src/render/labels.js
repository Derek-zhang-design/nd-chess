// Display text for pieces, axes and coordinates. Coordinates are shown 1-based.

import { WHITE } from '../engine/index.js';

const SYMBOLS = {
  king: ['♔', '♚'],
  queen: ['♕', '♛'],
  rook: ['♖', '♜'],
  bishop: ['♗', '♝'],
  knight: ['♘', '♞'],
  pawn: ['♙', '♟'],
};

const TYPE_ORDER = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function colorName(color) {
  return capitalize(color);
}

export function pieceSymbol(piece) {
  return SYMBOLS[piece.type][piece.color === WHITE ? 0 : 1];
}

// "Rook 2", or "Queen (pawn 3)" for a promoted pawn. Ids look like "white-rook-2".
export function pieceLabel(piece) {
  const [, originalType, number] = piece.id.split('-');
  if (originalType === piece.type) return `${capitalize(piece.type)} ${number}`;
  return `${capitalize(piece.type)} (${originalType} ${number})`;
}

export function fullLabel(piece) {
  return `${colorName(piece.color)} ${pieceLabel(piece)}`;
}

export function axisName(axis) {
  return `d${axis + 1}`;
}

export function formatCoord(pos) {
  return `(${pos.map((v) => v + 1).join(', ')})`;
}

export function formatDelta(delta) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${-delta}`;
  return '0';
}

// King, queen, rook, bishop, knight, pawn; then by number.
export function comparePieces(a, b) {
  return (
    TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
}
