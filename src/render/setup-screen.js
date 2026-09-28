// Configure screen: "[n]D Chess", where n is typed straight into the heading.

import { h } from './dom.js';

export const MIN_DIMENSIONS = 2;
export const MAX_DIMENSIONS = 20;

export function createSetupScreen({ value, onValidityChange, onSubmit }) {
  const input = h('input', {
    class: 'dim-input',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    maxlength: '2',
    'aria-label': 'Number of dimensions',
    'aria-describedby': 'dim-hint',
    value: String(value),
  });
  const hint = h('p', { id: 'dim-hint', class: 'setup-hint' },
    `Choose ${MIN_DIMENSIONS}–${MAX_DIMENSIONS} dimensions`);

  // Fit the field to its digits so "4D" and "12D" both read as one word.
  function fitWidth() {
    input.style.width = `${Math.max(input.value.length, 1) + 0.15}ch`;
  }

  // Digits only: strip anything else as it's typed or pasted.
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 2);
    if (digits !== input.value) input.value = digits;
    fitWidth();
    check();
  });
  fitWidth();
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') onSubmit();
  });

  function getValue() {
    if (input.value === '') return null;
    const n = Number(input.value);
    return n >= MIN_DIMENSIONS && n <= MAX_DIMENSIONS ? n : null;
  }

  function check() {
    const valid = getValue() !== null;
    input.classList.toggle('is-invalid', !valid);
    hint.classList.toggle('is-invalid', !valid);
    input.setAttribute('aria-invalid', String(!valid));
    onValidityChange(valid);
  }

  const element = h('section', { class: 'setup' },
    h('h1', { class: 'setup-title' }, input, 'D Chess'),
    hint,
  );

  return {
    element,
    getValue,
    check,
    focus() {
      input.focus();
      input.select();
    },
  };
}
