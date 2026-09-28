// Draws engine state to the page. Must not contain game rules.

export function createRenderer(root) {
  return {
    render(game) {
      root.textContent = `Engine status: ${game.status}`;
    },
  };
}
