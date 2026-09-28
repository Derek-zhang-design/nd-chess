// Tiny helpers for building DOM elements.
//   h('button', { class: 'btn', onClick: fn, disabled: true }, 'Label')
// Props: `class`, `dataset`, `on<Event>` listeners, and attributes. `true` sets an
// empty attribute; `false`, `null` and `undefined` skip it. Children can be nested
// arrays; `null`, `undefined` and `false` children are skipped.

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else el.setAttribute(key, value === true ? '' : String(value));
  }
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child);
  }
}

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  apply(el, props);
  append(el, children);
  return el;
}

export function svg(tag, props = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, props);
  append(el, children);
  return el;
}
