// App flow: configure screen → play → winner popup → back to configure.

import {
  createGame, getMoves, applyMove, getThreats, findPiece, DEFAULT_DIMENSIONS,
} from './engine/index.js';
import {
  createSetupScreen, createPlayScreen, createMoveDialog, createPicker,
  renderTopBar, hideTopBar, setActions, button, actionHint, winnerCard,
  colorName, fullLabel,
} from './render/index.js';

const topBar = document.getElementById('top-bar');
const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
const actions = document.getElementById('actions');

let dimensions = DEFAULT_DIMENSIONS;
let game = null;
let play = null;
let selection = null; // { pieceId, from, dialog, confirmButton } while the move dialog is open
let focusId = null; // an opponent piece pinned to highlight its threat arrows

function showOverlay(content) {
  overlay.replaceChildren(content);
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.replaceChildren();
  overlay.hidden = true;
}

// --- Configure screen ---------------------------------------------------------

function showSetup() {
  game = null;
  play = null;
  selection = null;
  focusId = null;
  hideTopBar(topBar);
  hideOverlay();

  const start = button('Start game', { primary: true, onClick: () => submit() });
  const setup = createSetupScreen({
    value: dimensions,
    onValidityChange: (valid) => { start.disabled = !valid; },
    onSubmit: () => submit(),
  });

  function submit() {
    const n = setup.getValue();
    if (n === null) return;
    dimensions = n;
    startGame();
  }

  app.replaceChildren(setup.element);
  setActions(actions, [start]);
  setup.focus();
}

// --- Play -----------------------------------------------------------------------

function startGame() {
  game = createGame({ dimensions });
  play = createPlayScreen({ onPieceClick: handlePieceClick });
  app.replaceChildren(play.element);
  refresh();
}

function refresh() {
  renderTopBar(topBar, game);
  play.update({
    game,
    threats: getThreats(game),
    selectedId: selection?.pieceId ?? null,
    focusId,
    arrowsHidden: selection !== null,
  });

  if (game.winner) {
    showOverlay(winnerCard(game));
    setActions(actions, [button('New game', { primary: true, onClick: showSetup })]);
  } else if (selection) {
    setActions(actions, [button('Cancel', { onClick: cancelMove }), selection.confirmButton]);
  } else {
    hideOverlay();
    setActions(actions, [actionHint(`Select a ${colorName(game.turn)} piece to move.`)]);
  }
}

function handlePieceClick(id) {
  if (game.winner || selection) return;
  const found = findPiece(game, id);
  if (!found) return;

  if (found.piece.color === game.turn) {
    openMoveDialog(found);
  } else {
    // Opponent piece: pin or unpin its threat arrows.
    focusId = focusId === id ? null : id;
    refresh();
  }
}

function openMoveDialog({ pos, piece }) {
  const confirmButton = button('Confirm move', { primary: true, onClick: confirmMove });
  const dialog = createMoveDialog({
    piece,
    from: pos,
    shape: game.shape,
    picker: createPicker(piece.type, getMoves(game, pos)),
    labelFor: (id) => fullLabel(findPiece(game, id).piece),
    onChange: (move) => { confirmButton.disabled = !move; },
  });
  confirmButton.disabled = !dialog.getMove();

  selection = { pieceId: piece.id, from: pos, dialog, confirmButton };
  focusId = null;
  showOverlay(dialog.element);
  refresh();
  dialog.focus();
}

function confirmMove() {
  const move = selection?.dialog.getMove();
  if (!move) return;
  game = applyMove(game, { from: selection.from, to: move.to }, { promotion: selection.dialog.getPromotion() });
  selection = null;
  refresh();
}

function cancelMove() {
  selection = null;
  refresh();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && selection) cancelMove();
});

showSetup();
