// Per-game settings. Everything the engine needs to know about the board comes from here.

export const DEFAULT_DIMENSIONS = 4;
export const DEFAULT_AXIS_SIZE = 8;

// The standard setup needs 8 files along d1 and room for both sides along d2.
export const MIN_STANDARD_D1 = 8;
export const MIN_STANDARD_D2 = 4;

// Options:
//   dimensions  number of axes (ignored when `shape` is given)
//   shape       size of each axis, e.g. [8, 8, 8, 8]
export function createConfig({ dimensions = DEFAULT_DIMENSIONS, shape } = {}) {
  const resolved = shape ? [...shape] : Array(dimensions).fill(DEFAULT_AXIS_SIZE);

  if (resolved.length < 2) {
    throw new Error(`A board needs at least 2 dimensions, got ${resolved.length}.`);
  }
  resolved.forEach((size, axis) => {
    if (!Number.isInteger(size) || size < 1) {
      throw new Error(`Axis d${axis + 1} must have a whole-number size of at least 1, got ${size}.`);
    }
  });

  return { shape: resolved };
}
