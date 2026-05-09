"""
Generate collision map from background image.
Analyzes background.png to detect walkable (floor) vs obstacle (wall/furniture) areas.
Outputs a collision.png where white=walkable, black=obstacle.
"""
from PIL import Image
import numpy as np
import os

TILE_SIZE = 32
BG_PATH = r"E:\2026Mineru比赛\web\public\assets\world\background.png"
OUT_PATH = r"E:\2026Mineru比赛\web\public\assets\world\collision.png"

def is_floor_region(img, x1, y1, x2, y2):
    """Analyze a tile region to determine if it's floor (walkable)."""
    crop = img.crop((x1, y1, x2, y2))
    pixels = np.array(crop)

    # Calculate average brightness and color variance
    avg = pixels.mean(axis=(0, 1))
    brightness = avg[:3].mean()

    # Floor tiles are typically:
    #   - Brightness > 100 (light colored floor)
    #   - Low variance (uniform surface like wood floor)
    # Wall/furniture tiles are:
    #   - Darker or very colorful
    #   - High variance (mixed colors)

    # Color variance within tile
    variance = pixels[:,:,:3].var()

    # Floor tiles: brightness 100-220, moderate variance (wood floor has some grain)
    # Walls/furniture: very dark (<50) or very high variance

    is_dark = brightness < 45
    is_too_complex = variance > 3500

    # Walls are often dark with low saturation
    r, g, b = avg[0], avg[1], avg[2]
    color_range = max(r, g, b) - min(r, g, b)
    is_wall_like = brightness < 90 and color_range < 40

    if is_dark or is_too_complex or is_wall_like:
        return False
    return True


def generate_collision_map():
    print(f"Loading background: {BG_PATH}")
    img = Image.open(BG_PATH).convert("RGBA")
    w, h = img.size
    print(f"  Background size: {w}x{h}")

    # Add margin handling
    grid_w = w // TILE_SIZE
    grid_h = h // TILE_SIZE
    print(f"  Grid: {grid_w}x{grid_h} tiles ({TILE_SIZE}px each)")

    # Create collision image
    collision = Image.new("L", (grid_w, grid_h), 255)  # Start all white (walkable)
    px = collision.load()

    # Analyze each tile
    obstacle_count = 0
    for ty in range(grid_h):
        for tx in range(grid_w):
            x1 = tx * TILE_SIZE
            y1 = ty * TILE_SIZE
            x2 = min(x1 + TILE_SIZE, w)
            y2 = min(y1 + TILE_SIZE, h)

            if not is_floor_region(img, x1, y1, x2, y2):
                px[tx, ty] = 0  # Black = obstacle
                obstacle_count += 1

    # Also mark edges as obstacles (border walls)
    for tx in range(grid_w):
        px[tx, 0] = 0  # Top edge
        px[tx, grid_h - 1] = 0  # Bottom edge
    for ty in range(grid_h):
        px[0, ty] = 0  # Left edge
        px[grid_w - 1, ty] = 0  # Right edge

    # Scale up for visibility (each pixel = 1 tile, scale to see clearly)
    # Save at grid resolution (1px per tile)
    collision.save(OUT_PATH)

    # Also save a scaled version for visual inspection
    scaled = collision.resize((grid_w * 8, grid_h * 8), Image.NEAREST)
    scaled_path = OUT_PATH.replace(".png", "_preview.png")
    scaled.save(scaled_path)

    total = grid_w * grid_h
    walkable = total - obstacle_count
    print(f"\n  Result: {obstacle_count} obstacles, {walkable} walkable ({walkable/total*100:.1f}%)")
    print(f"  Saved: {OUT_PATH} ({grid_w}x{grid_h} px)")
    print(f"  Preview: {scaled_path} (8x scaled)")


if __name__ == "__main__":
    generate_collision_map()
