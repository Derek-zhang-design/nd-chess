import { createGame } from './engine/index.js';
import { createRenderer } from './render/index.js';

const game = createGame();
const renderer = createRenderer(document.getElementById('app'));

renderer.render(game);
