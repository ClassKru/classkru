import { GAME } from './config.js';
import { DungeonScene } from './dungeon-scene.js';

const PhaserLib = window.Phaser;
const game = new PhaserLib.Game({
  type: PhaserLib.AUTO,
  parent: 'game-canvas',
  width: GAME.width,
  height: GAME.height,
  backgroundColor: '#dceced',
  transparent: false,
  antialias: true,
  roundPixels: false,
  scale: {
    mode: PhaserLib.Scale.FIT,
    autoCenter: PhaserLib.Scale.CENTER_BOTH,
    width: GAME.width,
    height: GAME.height,
  },
  render: {
    pixelArt: false,
    powerPreference: 'high-performance',
    clearBeforeRender: true,
  },
  scene: [DungeonScene],
});

window.mathWizardGame = game;
