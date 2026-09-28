// Coordinate helpers. A position is an array of 0-based integers, one per axis.

export function keyOf(pos) {
  return pos.join(',');
}

export function parseKey(key) {
  return key.split(',').map(Number);
}

export function inBounds(shape, pos) {
  for (let axis = 0; axis < shape.length; axis++) {
    if (pos[axis] < 0 || pos[axis] >= shape[axis]) return false;
  }
  return true;
}

// Returns a new position moved by `changes`, a list of { axis, delta }.
export function offset(pos, changes) {
  const next = pos.slice();
  for (const { axis, delta } of changes) next[axis] += delta;
  return next;
}

// Lists the axes where `to` differs from `from`, as { axis, delta }.
// Stops early and returns null once more than `limit` axes differ.
export function differences(from, to, limit = Infinity) {
  const diffs = [];
  for (let axis = 0; axis < from.length; axis++) {
    const delta = to[axis] - from[axis];
    if (delta === 0) continue;
    diffs.push({ axis, delta });
    if (diffs.length > limit) return null;
  }
  return diffs;
}
