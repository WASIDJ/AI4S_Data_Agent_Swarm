#!/usr/bin/env node
/**
 * generate-collision.js
 *
 * Generates a collision map (collision.png) for map-2 based on the layout
 * analysis of bg2.png (1448x1086 pixels).
 *
 * White pixels (255) = walkable
 * Black pixels (0)   = obstacle
 *
 * Run: node scripts/generate-collision.js
 */

const fs = require("fs");
const path = require("path");

// We use a minimal PNG writer (no external deps) — create a raw grayscale PNG
const WIDTH = 1448;
const HEIGHT = 1086;

// Create a buffer for the pixel data (1 byte per pixel, grayscale)
const pixels = Buffer.alloc(WIDTH * HEIGHT, 255); // Default: all walkable (white)

/**
 * Fill a rectangle with black (obstacle)
 */
function fillBlack(x, y, w, h) {
  for (let row = y; row < Math.min(y + h, HEIGHT); row++) {
    for (let col = x; col < Math.min(x + w, WIDTH); col++) {
      pixels[row * WIDTH + col] = 0;
    }
  }
}

/**
 * Fill a rectangle with white (walkable)
 */
function fillWhite(x, y, w, h) {
  for (let row = y; row < Math.min(y + h, HEIGHT); row++) {
    for (let col = x; col < Math.min(x + w, WIDTH); col++) {
      pixels[row * WIDTH + col] = 255;
    }
  }
}

// =============================================================================
// Border walls (thick stone walls around the entire map)
// =============================================================================
const WALL = 28;

// Top wall
fillBlack(0, 0, WIDTH, WALL);
// Bottom wall
fillBlack(0, HEIGHT - WALL, WIDTH, WALL);
// Left wall
fillBlack(0, 0, WALL, HEIGHT);
// Right wall
fillBlack(WIDTH - WALL, 0, WALL, HEIGHT);

// =============================================================================
// Vertical divider: separates left side (lobby + workstation) from right side (meeting + storage)
// x ≈ 640 area — a thick wall with two doorways
// =============================================================================
const DIVIDER_X = 590;
const DIVIDER_W = 28;

// Top section of divider (from top wall down to upper doorway)
fillBlack(DIVIDER_X, WALL, DIVIDER_W, 200);
// Middle section of divider (between upper and lower doorways)
fillBlack(DIVIDER_X, 200 + 80, DIVIDER_W, 260);
// Bottom section of divider (from lower doorway down to bottom wall)
fillBlack(DIVIDER_X, 200 + 80 + 260 + 80, DIVIDER_W, HEIGHT - WALL - (200 + 80 + 260 + 80));

// =============================================================================
// Horizontal divider: separates meeting room (top-right) from storage (bottom-right)
// =============================================================================
const HDIVIDER_Y = 510;
const HDIVIDER_H = 24;

// Horizontal wall from vertical divider to right wall
fillBlack(DIVIDER_X + DIVIDER_W, HDIVIDER_Y, WIDTH - WALL - (DIVIDER_X + DIVIDER_W), HDIVIDER_H);

// Doorway in horizontal divider (center)
const HDOOR_X = DIVIDER_X + DIVIDER_W + 150;
const HDOOR_W = 80;
fillWhite(HDOOR_X, HDIVIDER_Y, HDOOR_W, HDIVIDER_H);

// =============================================================================
// Left side: Lobby area (upper-left)
// =============================================================================
// Lobby is roughly x:28-590, y:28-460
// Sofa cluster (L-shaped seating area around coffee table)
fillBlack(50, 80, 180, 50);   // Sofa back (top)
fillBlack(50, 80, 50, 160);   // Sofa left side
fillBlack(50, 190, 180, 50);  // Sofa front (bottom)
fillBlack(180, 80, 50, 160);  // Sofa right side
// Coffee table in center of sofa
fillBlack(100, 130, 80, 60);

// Bookshelf / plant near top-left corner
fillBlack(30, 30, 20, 40);

// Floor lamp
fillBlack(270, 80, 24, 60);

// Potted plants in lobby
fillBlack(30, 280, 30, 30);
fillBlack(30, 380, 30, 30);
fillBlack(260, 420, 30, 30);

// =============================================================================
// Left side: Workstation area (lower-left)
// x:28-590, y:460-1058
// =============================================================================
// Three desk setups arranged vertically

// Desk 1 (upper workstation)
fillBlack(80, 500, 140, 40);  // Desk surface
fillBlack(80, 480, 30, 20);   // Chair behind desk
fillBlack(230, 500, 140, 40); // Desk surface (pair)
fillBlack(230, 480, 30, 20);  // Chair

// Desk 2 (middle workstation)
fillBlack(80, 620, 140, 40);
fillBlack(80, 600, 30, 20);
fillBlack(230, 620, 140, 40);
fillBlack(230, 600, 30, 20);

// Desk 3 (lower workstation)
fillBlack(80, 740, 140, 40);
fillBlack(80, 720, 30, 20);
fillBlack(230, 740, 140, 40);
fillBlack(230, 720, 30, 20);

// Computer monitors on desks (small obstacles)
fillBlack(120, 505, 20, 10);
fillBlack(270, 505, 20, 10);
fillBlack(120, 625, 20, 10);
fillBlack(270, 625, 20, 10);
fillBlack(120, 745, 20, 10);
fillBlack(270, 745, 20, 10);

// Shelving / storage unit at bottom-left
fillBlack(30, 900, 120, 60);
fillBlack(200, 900, 120, 60);

// Plants at bottom of workstation area
fillBlack(30, 800, 30, 30);
fillBlack(400, 870, 30, 30);

// Filing cabinets
fillBlack(450, 500, 60, 80);
fillBlack(450, 620, 60, 80);

// =============================================================================
// Right side: Meeting room (upper-right)
// x:618-1420, y:28-510
// =============================================================================
// Hexagonal conference table (approximate as octagonal shape)
const TABLE_CX = 820;
const TABLE_CY = 280;
const TABLE_R = 70;
// Draw a filled circle for the table
for (let dy = -TABLE_R; dy <= TABLE_R; dy++) {
  const dxMax = Math.floor(Math.sqrt(TABLE_R * TABLE_R - dy * dy));
  for (let dx = -dxMax; dx <= dxMax; dx++) {
    const px = TABLE_CX + dx;
    const py = TABLE_CY + dy;
    if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
      pixels[py * WIDTH + px] = 0;
    }
  }
}

// Chairs around the table (6 chairs)
fillBlack(TABLE_CX - 100, TABLE_CY - 20, 20, 40);  // Left chair
fillBlack(TABLE_CX + 80, TABLE_CY - 20, 20, 40);   // Right chair
fillBlack(TABLE_CX - 20, TABLE_CY - 100, 40, 20);  // Top chair
fillBlack(TABLE_CX - 20, TABLE_CY + 80, 40, 20);   // Bottom chair
fillBlack(TABLE_CX - 80, TABLE_CY - 80, 20, 20);   // Top-left chair
fillBlack(TABLE_CX + 60, TABLE_CY - 80, 20, 20);   // Top-right chair

// Tech display panels on right wall
fillBlack(1350, 100, 50, 60);
fillBlack(1350, 200, 50, 60);

// Whiteboard on top wall
fillBlack(700, 30, 120, 20);

// =============================================================================
// Right side: Storage/Dining area (lower-right)
// x:618-1420, y:534-1058
// =============================================================================
// Storage shelves (top section)
fillBlack(640, 570, 200, 50);
fillBlack(880, 570, 200, 50);

// Barrels/crates
fillBlack(640, 660, 40, 40);
fillBlack(700, 660, 40, 40);
fillBlack(760, 660, 40, 40);
fillBlack(640, 720, 40, 40);
fillBlack(700, 720, 40, 40);

// Dining table (circular, approximate)
const DTABLE_CX = 840;
const DTABLE_CY = 840;
const DTABLE_R = 50;
for (let dy = -DTABLE_R; dy <= DTABLE_R; dy++) {
  const dxMax = Math.floor(Math.sqrt(DTABLE_R * DTABLE_R - dy * dy));
  for (let dx = -dxMax; dx <= dxMax; dx++) {
    const px = DTABLE_CX + dx;
    const py = DTABLE_CY + dy;
    if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
      pixels[py * WIDTH + px] = 0;
    }
  }
}

// Chairs around dining table
fillBlack(DTABLE_CX - 70, DTABLE_CY - 15, 15, 30);
fillBlack(DTABLE_CX + 55, DTABLE_CY - 15, 15, 30);
fillBlack(DTABLE_CX - 15, DTABLE_CY - 70, 30, 15);
fillBlack(DTABLE_CX - 15, DTABLE_CY + 55, 30, 15);

// Refrigerator / large storage unit
fillBlack(1300, 560, 60, 100);

// Counter/sink area
fillBlack(1200, 950, 150, 50);

// Potted plant
fillBlack(1300, 960, 30, 30);

// =============================================================================
// Ensure doorways are walkable
// =============================================================================
// Upper doorway in vertical divider (y ≈ 200 to 280)
fillWhite(DIVIDER_X, 200, DIVIDER_W, 80);
// Lower doorway in vertical divider (y ≈ 540 to 620)
fillWhite(DIVIDER_X, 200 + 80 + 260, DIVIDER_W, 80);

// =============================================================================
// Write PNG file (minimal PNG format, no external deps)
// =============================================================================

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

// PNG Signature
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// IHDR chunk
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);   // Width
ihdr.writeUInt32BE(HEIGHT, 4);  // Height
ihdr[8] = 8;   // Bit depth
ihdr[9] = 0;   // Color type: Grayscale
ihdr[10] = 0;  // Compression
ihdr[11] = 0;  // Filter
ihdr[12] = 0;  // Interlace

// IDAT chunk — raw pixel data with filter bytes
const rawData = Buffer.alloc(HEIGHT * (1 + WIDTH));
for (let y = 0; y < HEIGHT; y++) {
  rawData[y * (1 + WIDTH)] = 0; // No filter
  pixels.copy(rawData, y * (1 + WIDTH) + 1, y * WIDTH, (y + 1) * WIDTH);
}

// Compress with zlib (deflate)
const zlib = require("zlib");
const compressed = zlib.deflateSync(rawData);

// IEND chunk
const iend = Buffer.alloc(0);

const output = Buffer.concat([
  signature,
  createChunk("IHDR", ihdr),
  createChunk("IDAT", compressed),
  createChunk("IEND", iend),
]);

const outputPath = path.join(
  __dirname,
  "..",
  "web",
  "public",
  "assets",
  "world",
  "maps",
  "map-2",
  "collision.png"
);

fs.writeFileSync(outputPath, output);
console.log(`Collision map written to: ${outputPath}`);
console.log(`Size: ${WIDTH}x${HEIGHT}`);
console.log(`File size: ${(output.length / 1024).toFixed(1)} KB`);

// Generate a preview by counting walkable vs blocked tiles
const TILE = 32;
let walkable = 0;
let blocked = 0;
for (let row = 0; row < Math.ceil(HEIGHT / TILE); row++) {
  for (let col = 0; col < Math.ceil(WIDTH / TILE); col++) {
    const cx = Math.min(col * TILE + TILE / 2, WIDTH - 1);
    const cy = Math.min(row * TILE + TILE / 2, HEIGHT - 1);
    if (pixels[Math.floor(cy) * WIDTH + Math.floor(cx)] === 255) {
      walkable++;
    } else {
      blocked++;
    }
  }
}
console.log(`Tiles: ${walkable} walkable, ${blocked} blocked (total ${walkable + blocked})`);
