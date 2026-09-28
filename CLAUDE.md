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
- **Default size:** the configure screen starts at 11 dimensions (`DEFAULT_SETUP_DIMENSIONS`). The engine's own default, used by `createGame()` with no options and by the tests, is 4. Every axis is 8. The dimension count and each axis's size are configurable per game.
- **Minimum sizes:** the standard setup needs d1 ≥ 8 and d2 ≥ 4. Extra axes can be any size from 1 up.

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

**App flow:** configure screen → play → winner popup → **New game** returns to the configure screen, keeping the last settings.

- **Configure screen:** a large centred heading, "[n]D Chess", where n is a text field typed directly into the heading. There's no description text.
  - Up and down chevron buttons sit above and below the number. The arrow keys also step it.
  - The field accepts digits only, in the range 2–20 for now, and defaults to **11**.
  - An out-of-range value turns the underline red and disables **Start game**. Enter also starts the game.
- **Action area:** a floating bar at the bottom of the screen holds every confirming button: Start game, Cancel / Confirm move, New game. When there's nothing to confirm, it shows a short hint.
- **Winner popup:** a prominent centred card with generous padding, reading "[Colour] wins!" and a one-line detail. It's shown over the final position, and **New game** appears in the action area.
- **Top bar:** game title ("4D Chess") and whose turn it is, or who won.
- **Visual style:**
  - **Zero saturation:** every colour is a neutral grey. Red is used only for threats (arrows and row outlines) and for an invalid dimension count.
  - **Accent:** light grey (`--accent`) with dark text, used for the primary button, the "to move" badge, pressed toggles and the slider. Not blue.
  - **Side themes:** Black's table and move dialog are black with white text (`.theme-black`); White's are white with black text (`.theme-white`). This holds regardless of light or dark mode.
  - **Monospace** for table content: the piece tables, the preview coordinates and the distance readout.
  - **Piece icons are hidden** until custom icons are designed. They're switched by `SHOW_PIECE_ICONS` in `src/render/labels.js`. The Unicode symbols are placeholders only.
- **Left edge:** a table of Black's pieces.
- **Right edge:** a table of White's pieces, laid out the same way.
- **Piece tables:**
  - One row per piece and one column per axis (d1 … dN). Coordinates are shown 1-based, in text one size smaller than the piece names.
  - Each side's table can be collapsed as a whole. Collapsed, it shows only the piece names, and the table shrinks to fit.
  - Tables stay on the outer edges of the screen. The gap between them is where the arrows run.
  - Captured pieces stay in the table, greyed out and struck through, at the bottom.
- **Threats:**
  - Arrows connect an attacking piece's row to the row of the piece it threatens, drawn across the gap between the tables. Arrows are hidden while the move dialog is open.
  - **Colour is from the view of the player to move.** Red means an arrow into one of their pieces (they are being threatened). Grey means an arrow from one of their pieces (they are threatening).
  - **Emphasis:** arrows are soft (faint) by default. Hovering over a piece, or clicking an opponent's piece to pin it, makes its arrows strong and dims all the others.
  - **Outlines:** a threatened piece's row gets an outline in the same colour and emphasis as the arrows pointing at it. It's strong when the piece itself or one of its attackers is highlighted. Colour is the threat marker; don't add badges.
  - **Faint colours are solid blends** (`color-mix` with the background behind them), never transparency, so overlapping lines and heads don't show through each other.
  - **Arrow ends:** each line stops at the middle of its arrowhead's base, and the head continues it to the target.
  - **Two points per row when needed:** if a piece both threatens and is threatened, its outgoing arrows leave above the row's centre and incoming arrows arrive below it. Otherwise arrows use the centre.
- **Choosing a move:** click one of your pieces, and a dialog in the centre offers its moves as controls rather than a flat list:
  - **Axis dropdowns list axes only** (d1 … dN). The sign comes from a signed slider, not the dropdown.
  - **Rook, bishop, queen, king:**
    - A dropdown for the first axis, and a signed slider for the distance along it, e.g. −3 … +4. Negative moves toward index 0. Zero is not a move.
    - The slider's range covers only legal distances. It stops at a blocking piece, and its end can be the square of an enemy piece (a capture).
    - An optional second dropdown picks a different axis for a diagonal. A +/− toggle beside it sets that axis's sign. The distance along the second axis always equals the slider's absolute value, so the slider's legal range is recalculated when the toggle changes.
    - For the king, the slider is limited to −1 … +1.
  - **Knight:** a dropdown and +/− toggle for the 2-step axis, and a dropdown and +/− toggle for the 1-step axis (a different axis). No slider.
  - **Pawn:** a dropdown for the forward axis, a slider of 1 … 2 (2 only on the first move), and a capture option for ±1 on d1.
  - **Illegal options stay visible but faint and unselectable.** Axes or toggle states that lead to no legal move remain in the dropdown or on the toggle, but are disabled.
  - Promotion: a piece picker in the same dialog.
- **Confirming:** a floating button area at the bottom confirms the chosen move, or cancels it.
- **Phones:** keep the layout. Expanded piece tables scroll horizontally in their own container rather than squeezing.

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
index.html               Entry point; loads src/main.js as an ES module
src/main.js              App flow: holds the game state, switches screens, handles clicks
src/engine/index.js      Public engine API (re-exports the modules below)
src/engine/coords.js     Position keys, bounds, offsets, axis differences
src/engine/config.js     Game settings (dimensions, axis sizes) and defaults
src/engine/pieces.js     Piece types, colours, standard starting position
src/engine/movement.js   Move generation and geometric attack tests
src/engine/game.js       Game state, applying moves, win detection, threats
src/render/index.js      Public render API (re-exports the modules below)
src/render/setup-screen.js  Configure screen ("[n]D Chess")
src/render/play-screen.js   Piece tables, red threat outlines, threat arrows (SVG)
src/render/move-dialog.js   Move dialog controls and preview
src/render/move-picker.js   Maps engine moves to dialog fields (no DOM; tested in Node)
src/render/chrome.js        Top bar, action area, buttons, winner popup
src/render/labels.js        Display text: piece names, symbols, 1-based coordinates
src/render/dom.js           h() / svg() element helpers
src/styles.css           Styles
tests/                   Engine tests (Node's built-in test runner)
.github/workflows/       Runs tests, then deploys to GitHub Pages
```

## Engine API

- `createGame({ dimensions, shape, pieces })`: all options are optional. Default is 4 dimensions of size 8 with the standard setup. `pieces` is a custom setup: `[{ type, color, pos, hasMoved? }]`.
- `getMoves(state, pos)`: all moves for the piece at `pos` (0-based position array).
  - Each move is `{ from, to, pieceId, captureId, changes, promotion }`.
  - `changes` lists the axes that move, as `[{ axis, delta }]`. The move dialog groups moves by it: one entry for a straight move, two for a diagonal, knight or pawn capture.
- `applyMove(state, { from, to }, { promotion })`: validates the move and returns a **new** state. It never mutates the old one. `promotion` defaults to `'queen'`.
- `getThreats(state)`: `[{ attackerId, targetId }]` for every enemy piece currently attacked.
- `attacks(state, from, to)`: whether the piece at `from` attacks square `to`, tested geometrically.
- `findPiece(state, id)`: `{ pos, piece }` or `null`.
- State shape: `{ config, shape, pieces: Map<key, { id, type, color, hasMoved }>, turn, winner, captured, history }`.
  - Piece ids (e.g. `white-rook-2`) stay the same for the whole game, so the UI can use them for table rows and arrows.

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

## Testing

```bash
npm test
```

This uses Node's built-in test runner, with no dependencies to install. Add a test for every rule change.

## Deployment

A push to `main` runs `.github/workflows/pages.yml`. It runs the tests, and if they pass, publishes the repo root to GitHub Pages. Live URL: https://derek-zhang-design.github.io/nd-chess/

## Open questions

None right now. The interface details are expected to change once there's something playable.
