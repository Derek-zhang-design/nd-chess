import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame, getMoves, applyMove, getThreats, attacks, findPiece, keyOf,
  WHITE, BLACK, KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN,
} from '../src/engine/index.js';

// A board with 8 on every axis and only the given pieces.
function board(n, pieces) {
  return createGame({ dimensions: n, pieces });
}

const center = (n) => Array(n).fill(3);
const targets = (moves) => moves.map((m) => keyOf(m.to)).sort();

// --- Config and setup --------------------------------------------------------

test('default game is 4D with 8 on every axis', () => {
  const game = createGame();
  assert.deepEqual(game.shape, [8, 8, 8, 8]);
  assert.equal(game.turn, WHITE);
  assert.equal(game.winner, null);
});

test('custom shape and dimension count', () => {
  assert.deepEqual(createGame({ dimensions: 20 }).shape.length, 20);
  assert.deepEqual(createGame({ shape: [8, 8, 3, 5] }).shape, [8, 8, 3, 5]);
});

test('rejects boards that are too small', () => {
  assert.throws(() => createGame({ dimensions: 1 }));
  assert.throws(() => createGame({ shape: [8, 8, 0] }));
  assert.throws(() => createGame({ shape: [7, 8, 8] }), /standard setup/);
});

test('standard setup sits on the d1 × d2 plane', () => {
  const game = createGame({ dimensions: 5 });
  assert.equal(game.pieces.size, 32);
  for (const key of game.pieces.keys()) {
    const [, , ...rest] = key.split(',').map(Number);
    assert.ok(rest.every((v) => v === 0), `${key} should be at index 0 on extra axes`);
  }
  assert.equal(game.pieces.get('4,0,0,0,0').type, KING);
  assert.equal(game.pieces.get('4,0,0,0,0').color, WHITE);
  assert.equal(game.pieces.get('4,7,0,0,0').color, BLACK);
  assert.equal(game.pieces.get('3,7,0,0,0').type, QUEEN);
});

test('pieces get stable, unique ids', () => {
  const ids = [...createGame().pieces.values()].map((p) => p.id);
  assert.equal(new Set(ids).size, 32);
  assert.ok(ids.includes('white-rook-1') && ids.includes('white-rook-2'));
});

// --- Movement counts at 20D --------------------------------------------------

test('20D knight on an open board has 4N(N−1) = 1,520 moves', () => {
  const game = board(20, [{ type: KNIGHT, color: WHITE, pos: center(20) }]);
  assert.equal(getMoves(game, center(20)).length, 1520);
});

test('20D king on an open board has 2N² = 800 moves', () => {
  const game = board(20, [{ type: KING, color: WHITE, pos: center(20) }]);
  assert.equal(getMoves(game, center(20)).length, 800);
});

test('20D queen from index 3 on every axis', () => {
  // Along one axis from 3: 4 squares up, 3 down = 7. Rook part: 20 × 7 = 140.
  // Per axis pair: (+,+) 4, and 3 for each of the other sign combos = 13. 190 pairs × 13 = 2,470.
  const game = board(20, [{ type: QUEEN, color: WHITE, pos: center(20) }]);
  assert.equal(getMoves(game, center(20)).length, 140 + 2470);
});

// --- Sliding pieces ----------------------------------------------------------

test('rooks in the starting position can already leave the plane', () => {
  const game = createGame();
  const moves = getMoves(game, [0, 0, 0, 0]);
  // Blocked on d1 by the knight and on d2 by the pawn; 7 squares each along d3 and d4.
  assert.equal(moves.length, 14);
  assert.ok(moves.every((m) => m.changes.length === 1 && m.changes[0].axis >= 2));
});

test('sliding stops at a blocker and can capture it', () => {
  const game = board(3, [
    { type: ROOK, color: WHITE, pos: [0, 0, 0] },
    { type: PAWN, color: BLACK, pos: [0, 0, 3] },
    { type: PAWN, color: WHITE, pos: [0, 2, 0] },
  ]);
  const moves = getMoves(game, [0, 0, 0]);
  const alongD3 = moves.filter((m) => m.changes[0].axis === 2);
  assert.deepEqual(targets(alongD3), ['0,0,1', '0,0,2', '0,0,3']);
  assert.equal(alongD3.find((m) => keyOf(m.to) === '0,0,3').captureId, 'black-pawn-1');
  const alongD2 = moves.filter((m) => m.changes[0].axis === 1);
  assert.deepEqual(targets(alongD2), ['0,1,0']);
});

test('bishops move equally along exactly two axes', () => {
  const game = board(3, [{ type: BISHOP, color: WHITE, pos: [0, 0, 0] }]);
  const moves = getMoves(game, [0, 0, 0]);
  assert.equal(moves.length, 21); // 7 along each of the 3 axis pairs
  for (const m of moves) {
    assert.equal(m.changes.length, 2);
    assert.equal(Math.abs(m.changes[0].delta), Math.abs(m.changes[1].delta));
  }
});

// --- Pawns -------------------------------------------------------------------

test('pawns advance along every axis except d1', () => {
  const game = createGame();
  assert.deepEqual(targets(getMoves(game, [0, 1, 0, 0])), [
    '0,2,0,0', '0,3,0,0', // d2 +1, +2
    '0,1,1,0', '0,1,2,0', // d3
    '0,1,0,1', '0,1,0,2', // d4
  ].sort());
});

test('black pawns go − on d2 but + on extra axes', () => {
  const game = createGame();
  assert.deepEqual(targets(getMoves(game, [0, 6, 0, 0])), [
    '0,5,0,0', '0,4,0,0',
    '0,6,1,0', '0,6,2,0',
    '0,6,0,1', '0,6,0,2',
  ].sort());
});

test('no double step after a pawn has moved', () => {
  const game = board(3, [{ type: PAWN, color: WHITE, pos: [0, 2, 0], hasMoved: true }]);
  assert.deepEqual(targets(getMoves(game, [0, 2, 0])), ['0,2,1', '0,3,0']);
});

test('a pawn cannot move forward into an occupied square', () => {
  const game = board(3, [
    { type: PAWN, color: WHITE, pos: [0, 1, 0] },
    { type: PAWN, color: BLACK, pos: [0, 2, 0] },
    { type: PAWN, color: BLACK, pos: [0, 1, 2] },
  ]);
  // d2 is blocked outright; d3 allows only the single step.
  assert.deepEqual(targets(getMoves(game, [0, 1, 0])), ['0,1,1']);
});

test('pawn captures need ±1 on d1 plus one step forward', () => {
  const game = board(3, [
    { type: PAWN, color: WHITE, pos: [3, 3, 0], hasMoved: true },
    { type: KNIGHT, color: BLACK, pos: [4, 4, 0] }, // forward d2 + d1: capture
    { type: KNIGHT, color: BLACK, pos: [2, 3, 1] }, // forward d3 + d1: capture
    { type: KNIGHT, color: BLACK, pos: [3, 4, 1] }, // forward on d2 and d3: not a capture
  ]);
  const captures = getMoves(game, [3, 3, 0]).filter((m) => m.captureId);
  assert.deepEqual(targets(captures), ['2,3,1', '4,4,0']);
});

test('promotion at the far end of any forward axis', () => {
  const game = board(3, [
    { type: PAWN, color: WHITE, pos: [0, 6, 0], hasMoved: true },
    { type: PAWN, color: WHITE, pos: [5, 2, 6], hasMoved: true },
    { type: PAWN, color: BLACK, pos: [7, 1, 0], hasMoved: true },
  ]);
  const promoting = (pos) => getMoves(game, pos).filter((m) => m.promotion).map((m) => keyOf(m.to));
  assert.deepEqual(promoting([0, 6, 0]), ['0,7,0']);
  assert.deepEqual(promoting([5, 2, 6]), ['5,2,7']);
  assert.deepEqual(promoting([7, 1, 0]), ['7,0,0']);

  const after = applyMove(game, { from: [5, 2, 6], to: [5, 2, 7] }, { promotion: KNIGHT });
  assert.equal(after.pieces.get('5,2,7').type, KNIGHT);
  assert.equal(after.history.at(-1).promotedTo, KNIGHT);
});

// --- Turns and winning -------------------------------------------------------

test('turns alternate and moves are validated', () => {
  const game = createGame();
  assert.throws(() => applyMove(game, { from: [0, 6, 0, 0], to: [0, 5, 0, 0] }), /white's turn/);
  assert.throws(() => applyMove(game, { from: [0, 1, 0, 0], to: [0, 4, 0, 0] }), /Illegal/);

  const next = applyMove(game, { from: [0, 1, 0, 0], to: [0, 1, 2, 0] });
  assert.equal(next.turn, BLACK);
  assert.equal(next.pieces.get('0,1,2,0').hasMoved, true);
  assert.equal(game.pieces.has('0,1,0,0'), true, 'original state is unchanged');
});

test('capturing the king wins the game', () => {
  const game = board(3, [
    { type: ROOK, color: WHITE, pos: [0, 0, 0] },
    { type: KING, color: WHITE, pos: [7, 0, 0] },
    { type: KING, color: BLACK, pos: [0, 0, 5] },
  ]);
  const won = applyMove(game, { from: [0, 0, 0], to: [0, 0, 5] });
  assert.equal(won.winner, WHITE);
  assert.equal(won.captured[0].type, KING);
  assert.deepEqual(getMoves(won, [7, 0, 0]), []);
  assert.throws(() => applyMove(won, { from: [7, 0, 0], to: [6, 0, 0] }), /over/);
});

test('findPiece looks pieces up by id', () => {
  const found = findPiece(createGame(), 'black-queen-1');
  assert.deepEqual(found.pos, [3, 7, 0, 0]);
});

// --- Threats -----------------------------------------------------------------

test('threats respect blockers', () => {
  const pieces = [
    { type: ROOK, color: WHITE, pos: [0, 0, 0] },
    { type: KING, color: BLACK, pos: [0, 0, 5] },
  ];
  assert.deepEqual(getThreats(board(3, pieces)), [
    { attackerId: 'white-rook-1', targetId: 'black-king-1' },
  ]);
  const blocked = board(3, [...pieces, { type: PAWN, color: WHITE, pos: [0, 0, 2] }]);
  assert.deepEqual(getThreats(blocked), []);
});

test('no threats in the starting position', () => {
  assert.deepEqual(getThreats(createGame({ dimensions: 6 })), []);
});

// attacks() works from geometry; getMoves() walks the board. They must agree.
test('attacks() matches the captures getMoves() finds, on random boards', () => {
  // mulberry32: small seeded generator using 32-bit integer maths, so it stays exact in JS.
  let seed = 12345;
  const rand = (n) => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) % n;
  };
  const types = [KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN];

  for (let round = 0; round < 50; round++) {
    const n = 2 + rand(5);
    const used = new Set();
    const pieces = [];
    for (let tries = 0; pieces.length < 24; tries++) {
      assert.ok(tries < 10000, 'random placement failed to find free squares');
      const pos = Array.from({ length: n }, () => rand(8));
      if (used.has(keyOf(pos))) continue;
      used.add(keyOf(pos));
      pieces.push({ type: types[rand(types.length)], color: rand(2) ? WHITE : BLACK, pos, hasMoved: true });
    }
    const game = board(n, pieces);

    for (const attacker of pieces) {
      const captures = new Set(getMoves(game, attacker.pos).filter((m) => m.captureId).map((m) => keyOf(m.to)));
      for (const target of pieces) {
        if (target.color === attacker.color) continue;
        assert.equal(
          attacks(game, attacker.pos, target.pos),
          captures.has(keyOf(target.pos)),
          `${attacker.type} [${attacker.pos}] vs [${target.pos}]`,
        );
      }
    }
  }
});
