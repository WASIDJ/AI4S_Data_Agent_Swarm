import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";

export function createPixelGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: "#1a1a2e",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, WorldScene],
    pixelArt: true,
    roundPixels: true,
    antialias: false,
  });
  return game;
}
