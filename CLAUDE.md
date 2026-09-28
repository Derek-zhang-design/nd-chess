# ND Chess

A browser-based multi-dimensional chess game, deployed as a static site to GitHub Pages.

## Goals

- **Playable in the browser.** No install and no backend. Opening the Pages URL is enough to play.
- **Multi-dimensional board.** The engine supports any number of axes. The initial target range is 2–20 dimensions.
- **Customizable games.** Eventually every setting (dimension count, axis sizes, piece counts, and later rules) can be chosen before a game starts. Build the engine around a game config object from the start, even while the UI only offers defaults.
- **Engine separate from rendering.** Game rules live in a pure engine with no DOM access, so they can be tested and reused on their own. The renderer only reads engine state and forwards user input.
- **Static and dependency-light.** Plain HTML, CSS, and native ES modules. No build step unless one is clearly worth it.
- **Build incrementally.** Add small, working steps one at a time. Keep the game loadable after every change.

## Design decisions

### Coordinates
- A position is an array of N integers, one per axis: `[d1, d2, …, dN]`.
- The engine uses 0-based indices. The UI shows coordinates 1-based, so "1" is the first square on an axis.

### Board
- **Sparse storage.** The board stores only its pieces, never a cell-by-cell grid. A 20D board at 8 per axis has about 10^18 cells.
  ```js
  board = {
    shape: [8, 8, 8, ...],                    // size of each axis
    pieces: Map<"3,1,0,...", { type, color, hasMoved }>, // key = coordinate joined with ","
  }
  ```
- A square is empty if its key isn't in `pieces`.
- **Default size:** 8 on every axis. Each axis's size will be configurable per game.

### Default starting position
- The standard chess setup on the d1 × d2 plane, with every other axis at its first square (UI "1", engine index 0).
- One king per side.
- Every other square on the board starts empty.

### Players
- Two-player hotseat only for now. No AI and no networking.

### Winning
- **King capture.** The game ends when a player captures the opponent's king.
- Moves are not checked for king safety. A player may move into, or stay in, an attacked square. There is no check, checkmate or stalemate for now.
- Don't assume one king per side anywhere in the engine: piece counts will become configurable (see Future options). Look kings up from the board rather than storing a single king position.

### Piece movement
A "diagonal" always means **equal distance along exactly 2 axes**. Direction counts are given for N = 20.

- **Rook:** any distance along exactly 1 axis. Blocked by pieces. 2N directions (40).
- **Bishop:** any equal distance along exactly 2 axes, in any sign combination. Blocked by pieces. 2N(N−1) directions (760). It stays on one square colour (by parity of the coordinate sum), as in classic chess.
- **Queen:** rook + bishop. 2N² directions (800).
- **King:** one step in any queen direction, meaning ±1 on one axis or ±1 on each of two axes. 2N² target squares (800).
- **Knight:** ±2 along one axis and ±1 along a different axis. Jumps over pieces. 4N(N−1) target squares (1,520).

### Pawns
- **Forward direction.** Pawns never move along d1, and never move backward.
  - On d2: White moves +, Black moves −, as in normal chess.
  - On d3 through dN: **both colours move +**, away from the starting plane. Both sides start at index 0 on these axes, so a − direction would leave Black's pawns unable to move.
  - Call d2 through dN a pawn's **forward axes**.
- **Move:** one step forward along any forward axis, into an empty square.
- **Double step:** on a pawn's first move, it may instead move two steps forward along any forward axis. Both squares must be empty. This requires tracking `hasMoved` per piece.
- **Capture (option a, the default):** one step forward along any forward axis, plus ±1 on d1, onto an enemy piece. This matches classic chess, where sideways means d1.
- **Promotion:** when a pawn reaches the last square in its forward direction on any forward axis. White on d2 = the last index. Black on d2 = index 0. Either colour on d3 through dN = the last index.
- **En passant:** not included for now. See Future options.

### Castling
- **Not supported for now.** See Future options.

### Interface (first version)
No graphical board. The game is played through lists of pieces and their coordinates.

- **Top bar:** game title and whose turn it is.
- **Left column:** Black's pieces as a vertical list, each with its coordinate.
- **Right column:** White's pieces, laid out the same way.
- **Threat arrows:** arrows connect an attacking piece to the piece it threatens, drawn across the gap between the lists.
- **Choosing a move:** click one of your pieces, and a dialog in the centre lists its possible moves.
- **Confirming:** a floating button area at the bottom confirms the chosen move, or cancels it.

### Performance rules
- Never enumerate every cell of the board.
- Piece movement must not use "every combination of -1/0/+1 across all axes", which has 3^N − 1 directions (about 3.5 billion at N = 20). Movement rules must grow slowly with N.
- Detect attacks by testing each piece's geometry against the target (which axes differ and by how much), not by generating all opponent moves.

## Future options

These have been discussed and deliberately left out for now. They are candidates for per-game settings.

- **Checkmate mode:** the classic win condition. The engine rejects moves that leave your king in check, and detects checkmate and stalemate. This should be fast enough even at 20D (about 10 million simple operations per full legal-move check).
- **Configurable piece counts:** any number of each piece type, including multiple kings. Multiple kings need a win rule, for example "capture all enemy kings" or "capture any enemy king".
- **Castling:**
  - **The move:** the king moves 2 squares toward the rook along one axis, and the rook lands on the square the king passed over. All squares between them must be empty, and they must be at least 3 squares apart.
  - **Classic rule:** neither the king nor the rook has moved. In the default setup, they only line up along d1, so castling would only ever happen along d1.
  - **Which pieces must be unmoved.** Options discussed:
    - (i) Both must be unmoved, as in classic chess. Castling is d1 only in the default setup.
    - (ii) Only the king must be unmoved. A rook can move into line with the king along any axis, then castle. This is the only option where castling happens on other axes in practice. It was the recommended choice if castling is added.
    - (iii) Only the rook must be unmoved. This is of little use, since rooks start in line with the king along d1 only.
  - **With checkmate mode:** add the classic condition that the king may not castle out of, through, or into an attacked square.
- **Pawn capture option (b):** one step forward along forward axis A, plus ±1 on *any* other axis B (not only d1). This makes pawns fully multi-dimensional attackers. It gives about 700 capture targets at N = 20, which is still cheap to check.
- **En passant:** generalized to a double step along any forward axis. It adds fiddly N-dimensional edge cases, so it was deferred.
- **Wider diagonals:** let bishops, queens and kings move equally along "up to K axes" instead of exactly 2. K must stay small: allowing all N axes brings back the 3^N − 1 direction explosion.

## Structure

```
index.html              Entry point; loads src/main.js as an ES module
src/main.js             Wires the engine to the renderer
src/engine/index.js     Game state and rules (pure JS, no DOM)
src/render/index.js     Draws state to the page and captures input
src/styles.css          Styles
.github/workflows/      GitHub Pages deployment
```

## Conventions

- **Deliver full files, not diffs.** When changing a file, provide its complete contents.
- **Use `rem` in CSS, not `px`.** Borders and hairlines are the only exception, and only when `rem` would render badly.
- **Engine code must not touch `document` or `window`.** Rendering code must not contain game rules.
- Use native ES modules (`import`/`export`) with relative paths that include the `.js` extension. The site is served from a subpath (`/nd-chess/`), so never use root-absolute paths like `/src/...`.

## Running locally

ES modules don't load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deployment

A push to `main` runs `.github/workflows/pages.yml`, which publishes the repo root to GitHub Pages. Live URL: https://derek-zhang-design.github.io/nd-chess/

## Open questions

Discuss these next:

- **Move list size.** A queen at 20D can have hundreds to thousands of moves. How should the move dialog group or filter them?
- **Threat arrows.** Show all of them at once, or only those for the selected piece or on hover?
- **Coordinate format.** How to show long coordinates (20 numbers at 20D) compactly in the piece lists.
- **Narrow screens.** How the two side-by-side lists work at phone width.
