// Turns a piece's move list (from the engine) into the move dialog's fields:
// axis dropdowns, sign toggles, and a signed distance slider.
// No DOM and no game rules: it only reorganizes moves the engine already produced.
//
// Each move is described as a tuple with one value per field. A field's available
// options are the distinct values at that position among tuples whose earlier
// values match the current selection, so choosing an axis narrows what follows.

import { KNIGHT, PAWN } from '../engine/index.js';

const FIELDS = {
  slide: [
    { name: 'axis', type: 'axis', label: 'Along' },
    { name: 'second', type: 'axis-optional', label: 'Diagonal with' },
    { name: 'secondSign', type: 'sign', label: 'Diagonal direction' },
    { name: 'distance', type: 'distance', label: 'Distance' },
  ],
  knight: [
    { name: 'longAxis', type: 'axis', label: 'Two squares along' },
    { name: 'longSign', type: 'sign', label: 'Direction' },
    { name: 'shortAxis', type: 'axis', label: 'One square along' },
    { name: 'shortSign', type: 'sign', label: 'Direction' },
  ],
  pawn: [
    { name: 'axis', type: 'axis', label: 'Forward along' },
    { name: 'side', type: 'side', label: 'Capture on d1' },
    { name: 'distance', type: 'distance', label: 'Distance' },
  ],
};

function kindOf(pieceType) {
  if (pieceType === KNIGHT) return 'knight';
  if (pieceType === PAWN) return 'pawn';
  return 'slide';
}

// A diagonal can be picked starting from either of its axes, so it yields two tuples.
function tuplesFor(kind, { changes }) {
  if (kind === 'slide') {
    if (changes.length === 1) return [[changes[0].axis, null, null, changes[0].delta]];
    const [p, q] = changes;
    return [
      [p.axis, q.axis, Math.sign(q.delta), p.delta],
      [q.axis, p.axis, Math.sign(p.delta), q.delta],
    ];
  }
  if (kind === 'knight') {
    const long = changes.find((c) => Math.abs(c.delta) === 2);
    const short = changes.find((c) => Math.abs(c.delta) === 1);
    return [[long.axis, Math.sign(long.delta), short.axis, Math.sign(short.delta)]];
  }
  if (changes.length === 1) return [[changes[0].axis, 0, changes[0].delta]];
  const side = changes.find((c) => c.axis === 0);
  const forward = changes.find((c) => c.axis !== 0);
  return [[forward.axis, side.delta, forward.delta]];
}

export function createPicker(pieceType, moves) {
  const kind = kindOf(pieceType);
  const entries = moves.flatMap((move) => tuplesFor(kind, move).map((values) => ({ values, move })));
  return { kind, fields: FIELDS[kind], entries };
}

function matchesPrefix(entryValues, values, length) {
  for (let i = 0; i < length; i++) {
    if (entryValues[i] !== values[i]) return false;
  }
  return true;
}

// Values field `index` can take, given the choices already made in earlier fields.
export function optionsAt(picker, values, index) {
  const options = new Set();
  for (const entry of picker.entries) {
    if (matchesPrefix(entry.values, values, index)) options.add(entry.values[index]);
  }
  return options;
}

function pickDefault(field, options, previous) {
  if (options.has(previous)) return previous;
  const list = [...options];
  if (list.length === 0) return previous ?? null;
  if (list.length === 1) return list[0];

  switch (field.type) {
    case 'axis-optional':
      if (options.has(null)) return null;
      return Math.min(...list.filter((v) => v !== null));
    case 'axis':
      return Math.min(...list);
    case 'sign':
      return options.has(1) ? 1 : -1;
    case 'side':
      return options.has(0) ? 0 : options.has(1) ? 1 : -1;
    case 'distance': {
      // Keep the slider where it is if it's still within range, even on 0,
      // which isn't a move. The dialog then asks for a non-zero distance.
      const min = Math.min(...list);
      const max = Math.max(...list);
      if (typeof previous === 'number' && previous >= min && previous <= max) return previous;
      return list.sort((a, b) => Math.abs(a) - Math.abs(b) || b - a)[0];
    }
    default:
      return list[0];
  }
}

// Returns a full set of values, keeping each current choice where it is still
// available and replacing the rest with sensible defaults.
export function settle(picker, values) {
  const settled = [];
  picker.fields.forEach((field, index) => {
    settled.push(pickDefault(field, optionsAt(picker, settled, index), values[index]));
  });
  return settled;
}

// The engine move the values describe, or null if they don't form a move.
export function resolve(picker, values) {
  const entry = picker.entries.find((e) => e.values.every((v, i) => v === values[i]));
  return entry ? entry.move : null;
}
