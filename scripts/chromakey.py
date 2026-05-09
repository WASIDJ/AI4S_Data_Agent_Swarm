"""
Background removal for sprite sheets.
Auto-detects green screen or black background and makes it transparent.
"""
from PIL import Image
import os


def detect_bg_color(img):
    """Sample corners to detect background color type."""
    px = img.load()
    w, h = img.size
    corners = [
        px[0, 0], px[w-1, 0], px[0, h-1], px[w-1, h-1],
        px[5, 5], px[w-6, 5], px[5, h-6], px[w-6, h-6],
        px[w//2, 0], px[w//2, h-1], px[0, h//2], px[w-1, h//2],
    ]
    green_count = sum(1 for r, g, b, _ in corners if g > 130 and r < 100 and b < 120)
    black_count = sum(1 for r, g, b, _ in corners if r < 30 and g < 30 and b < 30)
    if green_count >= 4:
        return "green"
    if black_count >= 4:
        return "black"
    return "unknown"


def remove_bg(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    bg_type = detect_bg_color(img)
    pixels = img.load()
    w, h = img.size
    removed = 0

    print(f"  Detected background: {bg_type}")

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]

            if bg_type == "green":
                if g > 130 and r < 100 and b < 120 and g > r * 1.3 and g > b * 1.3:
                    pixels[x, y] = (r, g, b, 0)
                    removed += 1
                elif g > 100 and r < 130 and b < 130 and g > r * 1.1:
                    greenness = min(max((g - max(r, b)) / 255.0, 0), 1)
                    new_a = int(a * (1 - greenness * 0.9))
                    pixels[x, y] = (r, g, b, new_a)
                    removed += 1

            elif bg_type == "black":
                # Near-black pixels -> transparent, but keep very dark character details
                brightness = (r + g + b) / 3
                if brightness < 15:
                    pixels[x, y] = (r, g, b, 0)
                    removed += 1
                elif brightness < 35:
                    # Edge: partial transparency
                    factor = 1 - (brightness - 15) / 20
                    new_a = int(a * factor)
                    pixels[x, y] = (r, g, b, new_a)
                    removed += 1

            else:
                # Unknown bg: try white/near-white removal
                if r > 240 and g > 240 and b > 240:
                    pixels[x, y] = (r, g, b, 0)
                    removed += 1

    img.save(output_path, "PNG")
    print(f"  {os.path.basename(input_path)}: {w}x{h}, removed {removed} pixels")
    return w, h

if __name__ == "__main__":
    sprites = [
        ("1f5399a1-a527-4a6e-9cb2-76d3708a61ce.png", "default.png"),
        ("c7154e4c-bb6c-4388-ab0e-18dfe924837e.png", "character-001.png"),
        ("unnamed.png", "character-002.png"),
    ]

    ref_dir = r"E:\2026Mineru比赛\ref"
    out_dir = r"E:\2026Mineru比赛\web\public\assets\world\sprites"
    os.makedirs(out_dir, exist_ok=True)

    for src_name, dst_name in sprites:
        src = os.path.join(ref_dir, src_name)
        dst = os.path.join(out_dir, dst_name)
        if not os.path.exists(src):
            print(f"  SKIP: {src_name} not found")
            continue
        print(f"Processing {src_name} -> {dst_name}")
        remove_bg(src, dst)

    print("\nDone! Check output in:", out_dir)
