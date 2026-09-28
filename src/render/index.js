// Draws engine state to the page. Must not contain game rules.
// Placeholder until the piece-table interface is built.

export function createRenderer(root) {
  return {
    render(game) {
      const dimensions = game.shape.length;
      const status = game.winner ? `${game.winner} wins` : `${game.turn} to move`;
      root.textContent = `${dimensions}D board (${game.shape.join(' × ')}) · ${game.pieces.size} pieces · ${status}`;
    },
  };
}
