// Configure screen: "[n]D Chess", where n is typed straight into the heading,
// with step buttons above and below the number.

import { h, svg } from './dom.js';

export const MIN_DIMENSIONS = 2;
export const MAX_DIMENSIONS = 20;
export const DEFAULT_SETUP_DIMENSIONS = 11;

function chevron(direction) {
  const d = direction === 'up' ? 'M 4 15 L 12 7 L 20 15' : 'M 4 9 L 12 17 L 20 9';
  return svg('svg', { class: 'chevron', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    svg('path', { d }));
}

export function createSetupScreen({ value, onValidityChange, onSubmit }) {
  const input = h('input', {
    class: 'dim-input',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    maxlength: '2',
    'aria-label': `Number of dimensions, ${MIN_DIMENSIONS} to ${MAX_DIMENSIONS}`,
    value: String(value),
  });
  const up = h('button', { type: 'button', class: 'step-button', 'aria-label': 'More dimensions', onClick: () => step(1) },
    chevron('up'));
  const down = h('button', { type: 'button', class: 'step-button', 'aria-label': 'Fewer dimensions', onClick: () => step(-1) },
    chevron('down'));

  // Fit the field to its digits so "4D" and "12D" both read as one word.
  function fitWidth() {
    input.style.width = `${Math.max(input.value.length, 1) + 0.15}ch`;
  }

  // Digits only: strip anything else as it's typed or pasted.
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 2);
    if (digits !== input.value) input.value = digits;
    changed();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') onSubmit();
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(event.key === 'ArrowUp' ? 1 : -1);
    }
  });

  function clamp(n) {
    return Math.min(MAX_DIMENSIONS, Math.max(MIN_DIMENSIONS, n));
  }

  // Steps from the current number, pulling an out-of-range value back into range.
  function step(delta) {
    const current = input.value === '' ? MIN_DIMENSIONS - delta : Number(input.value);
    input.value = String(clamp(current + delta));
    changed();
  }

  function getValue() {
    if (input.value === '') return null;
    const n = Number(input.value);
    return n >= MIN_DIMENSIONS && n <= MAX_DIMENSIONS ? n : null;
  }

  function changed() {
    fitWidth();
    const n = getValue();
    const valid = n !== null;
    input.classList.toggle('is-invalid', !valid);
    input.setAttribute('aria-invalid', String(!valid));
    up.disabled = valid && n >= MAX_DIMENSIONS;
    down.disabled = valid && n <= MIN_DIMENSIONS;
    onValidityChange(valid);
  }

  const element = h('section', { class: 'setup' },
    h('h1', { class: 'setup-title' },
      h('span', { class: 'stepper' }, up, input, down),
      h('span', {}, 'D Chess'),
    ),
  );

  changed();

  return {
    element,
    getValue,
    focus() {
      input.focus();
      input.select();
    },
  };
}
