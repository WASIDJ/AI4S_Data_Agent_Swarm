import Phaser from "phaser";
import type { WorldConfig, WorldArea, AgentSlot } from "../types";

/**
 * MapManager — owns the collision grid and provides spatial queries.
 *
 * The collision grid is a 2D boolean array where `true` means "blocked".
 * It is parsed from collision.png where dark pixels (red < 128) are obstacles.
 */
export class MapManager {
  /** collisionGrid[row][col] — true = obstacle */
  readonly collisionGrid: boolean[][];

  readonly config: WorldConfig;

  private areas: WorldArea[];

  constructor(scene: Phaser.Scene, config: WorldConfig) {
    this.config = config;
    this.areas = config.areas;
    this.collisionGrid = this.buildCollisionGrid(scene);
  }

  // ---------------------------------------------------------------------------
  // Collision grid construction
  // ---------------------------------------------------------------------------

  private buildCollisionGrid(scene: Phaser.Scene): boolean[][] {
    const { mapWidth, mapHeight, tileWidth, tileHeight } = this.config;
    const grid: boolean[][] = [];

    for (let row = 0; row < mapHeight; row++) {
      grid[row] = [];
      for (let col = 0; col < mapWidth; col++) {
        // Sample center pixel of each tile
        const px = Math.floor(col * tileWidth + tileWidth / 2);
        const py = Math.floor(row * tileHeight + tileHeight / 2);
        const color = scene.textures.getPixel(px, py, "world-collision");
        // No pixel or dark = blocked
        const blocked = color == null || color.red < 128;
        grid[row][col] = blocked;
      }
    }

    return grid;
  }

  // ---------------------------------------------------------------------------
  // Collision queries
  // ---------------------------------------------------------------------------

  /** Check if a world-pixel position is walkable. */
  isWalkable(worldX: number, worldY: number): boolean {
    const col = Math.floor(worldX / this.config.tileWidth);
    const row = Math.floor(worldY / this.config.tileHeight);
    return this.isTileWalkable(col, row);
  }

  /** Check if a tile coordinate is walkable. */
  isTileWalkable(col: number, row: number): boolean {
    if (row < 0 || row >= this.config.mapHeight) return false;
    if (col < 0 || col >= this.config.mapWidth) return false;
    return !this.collisionGrid[row][col];
  }

  /** Clamp a world position to the nearest walkable tile center. */
  clampToWalkable(worldX: number, worldY: number): { x: number; y: number } {
    const { tileWidth, tileHeight } = this.config;
    let col = Math.floor(worldX / tileWidth);
    let row = Math.floor(worldY / tileHeight);

    // Already walkable — snap to tile center
    if (this.isTileWalkable(col, row)) {
      return {
        x: col * tileWidth + tileWidth / 2,
        y: row * tileHeight + tileHeight / 2,
      };
    }

    // Search outward in a spiral for the nearest walkable tile
    for (let radius = 1; radius < 20; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          if (this.isTileWalkable(col + dc, row + dr)) {
            return {
              x: (col + dc) * tileWidth + tileWidth / 2,
              y: (row + dr) * tileHeight + tileHeight / 2,
            };
          }
        }
      }
    }

    // Fallback: return original snapped
    return {
      x: col * tileWidth + tileWidth / 2,
      y: row * tileHeight + tileHeight / 2,
    };
  }

  // ---------------------------------------------------------------------------
  // Area queries
  // ---------------------------------------------------------------------------

  /** Get all areas. */
  getAreas(): WorldArea[] {
    return this.areas;
  }

  /** Find area by id. */
  getAreaById(id: string): WorldArea | undefined {
    return this.areas.find(a => a.id === id);
  }

  /** Find the area that contains a world-pixel position. */
  getAreaAtPosition(worldX: number, worldY: number): WorldArea | undefined {
    return this.areas.find(
      a =>
        worldX >= a.x &&
        worldX < a.x + a.width &&
        worldY >= a.y &&
        worldY < a.y + a.height
    );
  }

  /** Get the area a tag maps to. */
  getAreaForTag(tag: string): WorldArea | undefined {
    const areaId =
      this.config.tagAreaMapping[tag] ?? this.config.tagAreaMapping["_default"];
    return this.getAreaById(areaId);
  }

  /** Get available agent slots for an area. */
  getSlots(areaId: string): AgentSlot[] {
    return this.config.agentSlots[areaId] ?? [];
  }
}
