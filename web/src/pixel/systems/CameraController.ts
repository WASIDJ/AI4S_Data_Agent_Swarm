import Phaser from "phaser";

/** Min / max zoom levels */
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

/**
 * CameraController — handles pan (drag), zoom (wheel), and focus-on-agent.
 *
 * Usage:
 *   const cam = new CameraController(scene);
 *   cam.fitMapToViewport(mapWidth, mapHeight);
 *   cam.focusAgent(x, y);
 */
export class CameraController {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;

  /** Is the user currently dragging? */
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartScrollX = 0;
  private camStartScrollY = 0;

  /** Subscription cleanup functions */
  private cleanups: Array<() => void> = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    this.setupDrag();
    this.setupZoom();
  }

  // ---------------------------------------------------------------------------
  // Pan (pointer drag)
  // ---------------------------------------------------------------------------

  private setupDrag(): void {
    // Stop any ongoing follow before drag begins
    const onDown = (pointer: Phaser.Input.Pointer) => {
      // Only react to left mouse button
      if (!pointer.leftButtonDown()) return;
      this.dragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.camStartScrollX = this.camera.scrollX;
      this.camStartScrollY = this.camera.scrollY;
      this.camera.stopFollow();
    };

    const onMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      this.camera.scrollX = this.camStartScrollX - dx / this.camera.zoom;
      this.camera.scrollY = this.camStartScrollY - dy / this.camera.zoom;
    };

    const onUp = () => {
      this.dragging = false;
    };

    this.scene.input.on("pointerdown", onDown);
    this.scene.input.on("pointermove", onMove);
    this.scene.input.on("pointerup", onUp);

    this.cleanups.push(() => {
      this.scene.input.off("pointerdown", onDown);
      this.scene.input.off("pointermove", onMove);
      this.scene.input.off("pointerup", onUp);
    });
  }

  // ---------------------------------------------------------------------------
  // Zoom (mouse wheel)
  // ---------------------------------------------------------------------------

  private setupZoom(): void {
    const onWheel = (
      _pointer: Phaser.Input.Pointer,
      _currentlyOver: unknown[],
      _dx: number,
      _dy: number,
      dz: number
    ) => {
      const newZoom = Phaser.Math.Clamp(
        this.camera.zoom - Math.sign(dz) * ZOOM_STEP,
        MIN_ZOOM,
        MAX_ZOOM
      );

      // Zoom toward pointer position
      const pointer = this.scene.input.activePointer;
      const worldX = this.camera.getWorldPoint(pointer.x, pointer.y);

      this.camera.setZoom(newZoom);

      // Adjust scroll so the point under the pointer stays fixed
      this.camera.centerOn(worldX.x, worldX.y);
      const after = this.camera.getWorldPoint(pointer.x, pointer.y);
      this.camera.scrollX += worldX.x - after.x;
      this.camera.scrollY += worldX.y - after.y;
    };

    this.scene.input.on("wheel", onWheel);
    this.cleanups.push(() => {
      this.scene.input.off("wheel", onWheel);
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Fit the entire map into the viewport. */
  fitMapToViewport(mapWidth: number, mapHeight: number): void {
    const { width, height } = this.scene.scale;
    const zoomX = width / mapWidth;
    const zoomY = height / mapHeight;
    const zoom = Phaser.Math.Clamp(Math.min(zoomX, zoomY), MIN_ZOOM, MAX_ZOOM);

    this.camera.setZoom(zoom);
    this.camera.centerOn(mapWidth / 2, mapHeight / 2);
  }

  /** Smoothly pan the camera to focus on a world position. */
  focusAgent(worldX: number, worldY: number): void {
    this.scene.tweens.add({
      targets: this.camera,
      scrollX: worldX - this.camera.width / 2 / this.camera.zoom,
      scrollY: worldY - this.camera.height / 2 / this.camera.zoom,
      duration: 600,
      ease: "Power2",
    });
  }

  /** Stop camera follow. */
  stopFollow(): void {
    this.camera.stopFollow();
  }

  /** Get current zoom level. */
  getZoom(): number {
    return this.camera.zoom;
  }

  /** Set zoom level directly. */
  setZoom(zoom: number): void {
    this.camera.setZoom(Phaser.Math.Clamp(zoom, MIN_ZOOM, MAX_ZOOM));
  }

  /** Tear down all listeners. Call when the scene is destroyed. */
  destroy(): void {
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups = [];
  }
}
