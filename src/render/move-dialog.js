// Move dialog: axis dropdowns, sign toggles and a signed distance slider for one piece.
// Controls are built once and updated in place, so dragging the slider isn't interrupted.

import { h } from './dom.js';
import { PROMOTION_TYPES, QUEEN } from '../engine/index.js';
import { optionsAt, resolve, settle } from './move-picker.js';
import {
  SHOW_PIECE_ICONS, axisName, capitalize, formatCoord, formatDelta, fullLabel, pieceSymbol,
} from './labels.js';

let dialogCount = 0;

function fieldRow(labelText, control, forId, labelId) {
  const label = forId
    ? h('label', { class: 'field-label', for: forId, id: labelId }, labelText)
    : h('span', { class: 'field-label', id: labelId }, labelText);
  return h('div', { class: 'field-row' }, label, control);
}

function axisOption(option) {
  return option.value === 'none' ? null : Number(option.value);
}

// Every control has a `row` element and `sync(options, value)`, which marks
// unavailable choices as disabled (still visible) and shows the current value.
function createControl(field, id, shape, set) {
  const labelId = `${id}-label`;

  switch (field.type) {
    case 'axis':
    case 'axis-optional': {
      const select = h('select', {
        id,
        class: 'field-select',
        onChange: () => set(axisOption(select.selectedOptions[0])),
      },
        field.type === 'axis-optional' && h('option', { value: 'none' }, 'None (straight line)'),
        shape.map((_, axis) => h('option', { value: String(axis) }, axisName(axis))),
      );
      return {
        row: fieldRow(field.label, select, id, labelId),
        sync(options, value) {
          for (const option of select.options) option.disabled = !options.has(axisOption(option));
          select.value = value === null ? 'none' : String(value);
        },
      };
    }

    case 'sign':
    case 'side': {
      const choices = field.type === 'sign'
        ? [[-1, '−'], [1, '+']]
        : [[-1, '−'], [0, 'None'], [1, '+']];
      const buttons = choices.map(([value, text]) => [
        value,
        h('button', { type: 'button', class: 'segment', onClick: () => set(value) }, text),
      ]);
      const row = fieldRow(field.label,
        h('div', { class: 'segmented', role: 'group', 'aria-labelledby': labelId }, buttons.map(([, b]) => b)),
        null, labelId);
      return {
        row,
        sync(options, value) {
          // A straight move has no second axis, so its sign toggle is hidden.
          row.hidden = options.size === 1 && options.has(null);
          for (const [v, button] of buttons) {
            button.disabled = !options.has(v);
            button.setAttribute('aria-pressed', String(v === value));
          }
        },
      };
    }

    case 'distance': {
      const input = h('input', {
        id,
        type: 'range',
        step: '1',
        class: 'field-range',
        onInput: () => set(Number(input.value)),
      });
      const output = h('output', { for: id, class: 'field-output' });
      return {
        row: fieldRow(field.label, h('div', { class: 'distance' }, input, output), id, labelId),
        sync(options) {
          const list = [...options];
          if (list.length === 0) return;
          input.min = String(Math.min(...list));
          input.max = String(Math.max(...list));
          input.disabled = list.length === 1;
        },
        syncValue(value) {
          input.value = String(value);
          output.textContent = formatDelta(value);
        },
      };
    }

    default:
      throw new Error(`Unknown field type: ${field.type}`);
  }
}

function coordTable(pos, changed) {
  return h('table', { class: 'coord-table' },
    h('thead', {},
      h('tr', {}, pos.map((_, axis) =>
        h('th', { scope: 'col', class: changed.has(axis) ? 'is-changed' : null }, axisName(axis)))),
    ),
    h('tbody', {},
      h('tr', {}, pos.map((v, axis) =>
        h('td', { class: changed.has(axis) ? 'is-changed' : null }, String(v + 1)))),
    ),
  );
}

// Options:
//   piece, from   the piece being moved and its position
//   shape         board shape (for listing axes)
//   picker        from createPicker(piece.type, moves)
//   labelFor(id)  display name for a captured piece
//   onChange(move | null)  called whenever the chosen move changes
export function createMoveDialog({ piece, from, shape, picker, labelFor, onChange }) {
  const uid = `move-dialog-${++dialogCount}`;
  let values = settle(picker, []);
  let promotion = QUEEN;

  const controls = picker.fields.map((field, i) =>
    createControl(field, `${uid}-f${i}`, shape, (value) => {
      values[i] = value;
      update(true);
    }));
  const preview = h('div', { class: 'dialog-preview', 'aria-live': 'polite' });
  const hasMoves = picker.entries.length > 0;

  const element = h('section', {
    class: `dialog theme-${piece.color}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': `${uid}-title`,
  },
    h('header', { class: 'dialog-header' },
      h('h2', { class: 'dialog-title', id: `${uid}-title` },
        SHOW_PIECE_ICONS && h('span', { class: 'symbol', 'aria-hidden': 'true' }, pieceSymbol(piece)),
        fullLabel(piece)),
      h('p', { class: 'dialog-subtitle' }, `Currently at ${formatCoord(from)}`),
    ),
    hasMoves
      ? h('div', { class: 'dialog-fields' }, controls.map((c) => c.row))
      : h('p', { class: 'dialog-empty' }, 'This piece has no moves right now.'),
    preview,
  );

  function update(notify) {
    values = settle(picker, values);
    controls.forEach((control, i) => {
      control.sync(optionsAt(picker, values, i), values[i]);
      control.syncValue?.(values[i]);
    });
    renderPreview();
    if (notify) onChange?.(resolve(picker, values));
  }

  function renderPreview() {
    if (!hasMoves) {
      preview.replaceChildren();
      return;
    }
    const move = resolve(picker, values);
    if (!move) {
      preview.replaceChildren(h('p', { class: 'dialog-note' }, 'Choose a distance other than 0.'));
      return;
    }
    const changed = new Set(move.changes.map((c) => c.axis));
    const parts = [
      h('p', { class: 'preview-label' }, 'Moves to'),
      h('div', { class: 'table-scroll' }, coordTable(move.to, changed)),
      h('p', { class: 'preview-summary' },
        move.changes.map((c) => `${axisName(c.axis)} ${formatDelta(c.delta)}`).join(' · ')),
    ];
    if (move.captureId) parts.push(h('p', { class: 'preview-capture' }, `Captures ${labelFor(move.captureId)}`));
    if (move.promotion) parts.push(promotionPicker());
    preview.replaceChildren(...parts);
  }

  function promotionPicker() {
    const labelId = `${uid}-promotion`;
    return h('div', { class: 'promotion' },
      h('span', { class: 'field-label', id: labelId }, 'Promote to'),
      h('div', { class: 'segmented', role: 'group', 'aria-labelledby': labelId },
        PROMOTION_TYPES.map((type) => h('button', {
          type: 'button',
          class: 'segment',
          'aria-pressed': String(type === promotion),
          onClick: () => {
            promotion = type;
            renderPreview();
          },
        },
          SHOW_PIECE_ICONS && h('span', { class: 'symbol', 'aria-hidden': 'true' }, pieceSymbol({ type, color: piece.color })),
          capitalize(type))),
      ),
    );
  }

  update(false);

  return {
    element,
    getMove: () => resolve(picker, values),
    getPromotion: () => promotion,
    focus() {
      element.querySelector('select, button, input')?.focus();
    },
  };
}
