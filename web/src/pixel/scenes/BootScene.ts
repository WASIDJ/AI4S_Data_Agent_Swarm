import Phaser from "phaser";

/**
 * BootScene — loads all world assets and shows a progress bar.
 * Transitions to WorldScene when loading is complete.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    const { width, height } = this.cameras.main;

    // --- Loading progress bar ---
    const barWidth = Math.min(width * 0.6, 400);
    const barHeight = 16;
    const barX = (width - barWidth) / 2;
    const barY = height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x222244, 0.8);
    bg.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

    const bar = this.add.graphics();
    this.load.on("progress", (value: number) => {
      bar.clear();
      bar.fillStyle(0x6c5ce7, 1);
      bar.fillRect(barX, barY, barWidth * value, barHeight);
    });

    const loadingText = this.add
      .text(width / 2, barY - 30, "Loading world...", {
        fontSize: "18px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    this.load.on("complete", () => {
      bg.destroy();
      bar.destroy();
      loadingText.destroy();
    });

    // --- Load world config ---
    this.load.json("world-config", "assets/world/config.json");

    // --- Load images ---
    this.load.image("world-bg", "assets/world/background.png");
    this.load.image("world-collision", "assets/world/collision.png");

    // --- Load character sprite sheets (6 cols x 5 rows, 170x204 per frame) ---
    const frameWidth = 170;
    const frameHeight = 204;

    this.load.spritesheet(
      "character-default",
      "assets/world/sprites/default.png",
      { frameWidth, frameHeight }
    );

    this.load.spritesheet(
      "character-001",
      "assets/world/sprites/character-001.png",
      { frameWidth, frameHeight }
    );

    this.load.spritesheet(
      "character-002",
      "assets/world/sprites/character-002.png",
      { frameWidth, frameHeight }
    );
  }

  create(): void {
    this.scene.start("WorldScene");
  }
}
