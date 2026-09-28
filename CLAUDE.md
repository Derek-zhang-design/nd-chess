# ND Chess

A browser-based multi-dimensional chess game, deployed as a static site to GitHub Pages.

## Goals

- **Playable in the browser.** No install and no backend. Opening the Pages URL is enough to play.
- **Multi-dimensional board.** The engine models a board with an arbitrary number of axes (2D, 3D, 4D, …) and doesn't hard-code any one layout.
- **Engine separate from rendering.** Game rules live in a pure engine with no DOM access, so they can be tested and reused on their own. The renderer only reads engine state and forwards user input.
- **Static and dependency-light.** Plain HTML, CSS, and native ES modules. No build step unless one is clearly worth it.
- **Build incrementally.** Add small, working steps one at a time. Keep the game loadable after every change.

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

A push to `main` runs `.github/workflows/pages.yml`, which publishes the repo root to GitHub Pages. In the repo settings, set **Settings → Pages → Source** to **GitHub Actions**.

## Open questions

These are still undecided:

- How many dimensions, and how big is each axis?
- Which pieces are there, and how do movement rules generalize to N dimensions?
- How are extra dimensions shown: a grid of 2D slices, a 3D view, or something else?
- Is play hotseat only, or is there an AI or online multiplayer?
