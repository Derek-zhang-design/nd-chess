import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, getMoves, keyOf, WHITE, BLACK, QUEEN, ROOK, KNIGHT, PAWN, KING } from '../src/engine/index.js';
import { createPicker, optionsAt, settle, resolve } from '../src/render/move-picker.js';

function pickerAt(game, pos) {
  const piece = game.pieces.get(keyOf(pos));
  return createPicker(piece.type, getMoves(game, pos));
}

const sorted = (set) => [...set].sort((a, b) => (a ?? -1) - (b ?? -1));

test('rook: only straight lines, distance range follows the ray', () => {
  const game = createGame({ dimensions: 3, pieces: [{ type: ROOK, color: WHITE, pos: [3, 3, 0] }] });
  const picker = pickerAt(game, [3, 3, 0]);
  const values = settle(picker, []);

  assert.deepEqual(sorted(optionsAt(picker, values, 0)), [0, 1, 2]);
  assert.deepEqual(sorted(optionsAt(picker, values, 1)), [null], 'no diagonal for a rook');
  assert.deepEqual(values.slice(1, 3), [null, null]);
  assert.deepEqual(sorted(optionsAt(picker, values, 3)), [-3, -2, -1, 1, 2, 3, 4]);
  assert.equal(values[3], 1, 'defaults to the smallest positive distance');
});

test('queen: diagonal with a second axis and sign', () => {
  const game = createGame({ dimensions: 3, pieces: [{ type: QUEEN, color: WHITE, pos: [0, 0, 0] }] });
  const picker = pickerAt(game, [0, 0, 0]);

  const values = settle(picker, [2, 0, 1, 3]);
  assert.deepEqual(values, [2, 0, 1, 3]);
  assert.deepEqual(resolve(picker, values).to, [3, 0, 3]);

  // From a corner, only + directions exist.
  assert.deepEqual(sorted(optionsAt(picker, values, 2)), [1]);
  assert.deepEqual(sorted(optionsAt(picker, values, 1)), [null, 0, 1]);
});

test('diagonal range depends on the second axis sign', () => {
  const game = createGame({ dimensions: 2, pieces: [{ type: QUEEN, color: WHITE, pos: [1, 5] }] });
  const picker = pickerAt(game, [1, 5]);
  // Along d1, with d2 going +: d1 can go from −1 to +2 (d2 hits the edge at 7).
  assert.deepEqual(sorted(optionsAt(picker, [0, 1, 1], 3)), [-1, 1, 2]);
  // With d2 going −: d1 can go from −1 to +5.
  assert.deepEqual(sorted(optionsAt(picker, [0, 1, -1], 3)), [-1, 1, 2, 3, 4, 5]);
});

test('distance 0 is kept on the slider but does not resolve to a move', () => {
  const game = createGame({ dimensions: 2, pieces: [{ type: ROOK, color: WHITE, pos: [3, 3] }] });
  const picker = pickerAt(game, [3, 3]);
  const values = settle(picker, [0, null, null, 0]);
  assert.equal(values[3], 0);
  assert.equal(resolve(picker, values), null);
});

test('changing an earlier field repairs later ones', () => {
  const game = createGame({ dimensions: 3, pieces: [{ type: ROOK, color: WHITE, pos: [0, 0, 0] }] });
  const picker = pickerAt(game, [0, 0, 0]);
  // A distance of −3 isn't possible from index 0, so it resets to the default.
  assert.deepEqual(settle(picker, [1, null, null, -3]), [1, null, null, 1]);
});

test('knight: axes and signs for the 2-step and the 1-step', () => {
  const game = createGame({ dimensions: 3, pieces: [{ type: KNIGHT, color: WHITE, pos: [0, 0, 0] }] });
  const picker = pickerAt(game, [0, 0, 0]);
  const values = settle(picker, [2, 1, 0, 1]);
  assert.deepEqual(resolve(picker, values).to, [1, 0, 2]);
  assert.deepEqual(sorted(optionsAt(picker, [2, 1], 2)), [0, 1], 'the 1-step axis must differ from the 2-step axis');
});

test('pawn: d1 disabled, black moves − on d2, captures via the side field', () => {
  const game = createGame({
    dimensions: 3,
    pieces: [
      { type: PAWN, color: BLACK, pos: [3, 6, 0] },
      { type: KING, color: WHITE, pos: [4, 5, 0] },
    ],
  });
  const picker = pickerAt(game, [3, 6, 0]);

  assert.deepEqual(sorted(optionsAt(picker, [], 0)), [1, 2], 'never along d1');
  assert.deepEqual(sorted(optionsAt(picker, [1, 0], 2)), [-2, -1]);
  assert.deepEqual(sorted(optionsAt(picker, [1], 1)), [0, 1], 'capture to d1 + only');

  const capture = resolve(picker, settle(picker, [1, 1]));
  assert.deepEqual(capture.to, [4, 5, 0]);
  assert.equal(capture.captureId, 'white-king-1');
});

test('starting position: every white piece that can move resolves to a legal move', () => {
  const game = createGame({ dimensions: 4 });
  for (const [key, piece] of game.pieces) {
    if (piece.color !== WHITE) continue;
    const pos = key.split(',').map(Number);
    const picker = createPicker(piece.type, getMoves(game, pos));
    if (picker.entries.length === 0) continue;
    assert.ok(resolve(picker, settle(picker, [])), `${piece.id} default should be a move`);
  }
});
