import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { safeWrite, loadJson, migrate, FileStore } from "./fileStore.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

function tmpPath(name: string): string {
  return path.join(tmpDir, name);
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "filestore-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// safeWrite
// ---------------------------------------------------------------------------

describe("safeWrite", () => {
  it("writes JSON to file", async () => {
    const fp = tmpPath("test.json");
    await safeWrite(fp, { hello: "world" });

    const content = fs.readFileSync(fp, "utf-8");
    expect(JSON.parse(content)).toEqual({ hello: "world" });
  });

  it("overwrites existing file atomically", async () => {
    const fp = tmpPath("test.json");
    await safeWrite(fp, { version: 1 });
    await safeWrite(fp, { version: 2 });

    const content = fs.readFileSync(fp, "utf-8");
    expect(JSON.parse(content)).toEqual({ version: 2 });
  });

  it("does not leave .tmp files after successful write", async () => {
    const fp = tmpPath("clean.json");
    await safeWrite(fp, { ok: true });

    const files = fs.readdirSync(tmpDir);
    const tmpFiles = files.filter((f) => f.includes(".tmp"));
    expect(tmpFiles).toHaveLength(0);
  });

  it("handles concurrent writes without corruption", async () => {
    const fp = tmpPath("concurrent.json");
    const N = 5;

    const writes = Array.from({ length: N }, (_, i) =>
      safeWrite(fp, { index: i }),
    );
    await Promise.all(writes);

    const content = fs.readFileSync(fp, "utf-8");
    const data = JSON.parse(content);
    expect(data).toHaveProperty("index");
    expect(typeof data.index).toBe("number");
    expect(data.index).toBeGreaterThanOrEqual(0);
    expect(data.index).toBeLessThan(N);

    // No leftover tmp files
    const files = fs.readdirSync(tmpDir);
    const tmpFiles = files.filter((f) => f.includes(".tmp"));
    expect(tmpFiles).toHaveLength(0);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// loadJson
// ---------------------------------------------------------------------------

describe("loadJson", () => {
  it("returns default value when file does not exist", async () => {
    const fp = tmpPath("missing.json");
    const data = await loadJson(fp, { _schema_version: 1, items: [] });

    expect(data).toEqual({ _schema_version: 1, items: [] });
    // File should have been created
    expect(fs.existsSync(fp)).toBe(true);
  });

  it("reads existing file", async () => {
    const fp = tmpPath("exists.json");
    fs.writeFileSync(fp, JSON.stringify({ hello: "world" }));

    const data = await loadJson(fp, { default: true });
    expect(data).toEqual({ hello: "world" });
  });

  it("handles empty file (returns default)", async () => {
    const fp = tmpPath("empty.json");
    fs.writeFileSync(fp, "");

    const data = await loadJson(fp, { _schema_version: 1, items: [] });
    expect(data).toEqual({ _schema_version: 1, items: [] });
  });
});

// ---------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------

describe("migrate", () => {
  it("does nothing when version matches target", async () => {
    const fp = tmpPath("migrate.json");
    const data = { _schema_version: 2, value: "keep" };
    const result = await migrate(fp, data, 2, {});

    expect(result._schema_version).toBe(2);
    expect((result as any).value).toBe("keep");
  });

  it("runs migrations in order", async () => {
    const fp = tmpPath("migrate.json");
    const migrations = {
      1: (d: Record<string, unknown>) => ({ ...d, step1: true, _schema_version: 2 }),
      2: (d: Record<string, unknown>) => ({ ...d, step2: true, _schema_version: 3 }),
    };

    const result = await migrate(fp, { _schema_version: 1 }, 3, migrations);
    expect(result._schema_version).toBe(3);
    expect((result as any).step1).toBe(true);
    expect((result as any).step2).toBe(true);
  });

  it("persists migrated data to disk", async () => {
    const fp = tmpPath("persist.json");
    const migrations = {
      1: (d: Record<string, unknown>) => ({ ...d, migrated: true }),
    };

    await migrate(fp, { _schema_version: 1, items: [] }, 2, migrations);

    const onDisk = JSON.parse(fs.readFileSync(fp, "utf-8"));
    expect(onDisk._schema_version).toBe(2);
    expect(onDisk.migrated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FileStore class
// ---------------------------------------------------------------------------

describe("FileStore", () => {
  it("loads default when file missing", async () => {
    const store = new FileStore({
      filePath: tmpPath("store.json"),
      defaultValue: { _schema_version: 1, items: [] },
      currentVersion: 1,
    });

    await store.load();
    expect(store.getData()).toEqual({ _schema_version: 1, items: [] });
  });

  it("save persists data and getData returns it", async () => {
    const fp = tmpPath("store.json");
    const store = new FileStore({
      filePath: fp,
      defaultValue: { _schema_version: 1, items: [] },
      currentVersion: 1,
    });

    await store.load();
    await store.save({ _schema_version: 1, items: [{ id: "a" }] });

    const data = store.getData();
    expect(data.items).toEqual([{ id: "a" }]);

    // Also verify on disk
    const onDisk = JSON.parse(fs.readFileSync(fp, "utf-8"));
    expect(onDisk.items).toEqual([{ id: "a" }]);
  });

  it("serialises concurrent saves (no corruption)", async () => {
    const fp = tmpPath("serial.json");
    const store = new FileStore({
      filePath: fp,
      defaultValue: { _schema_version: 1, counter: 0 },
      currentVersion: 1,
    });

    await store.load();

    // Fire 50 concurrent saves
    const saves = Array.from({ length: 50 }, (_, i) =>
      store.save({ _schema_version: 1, counter: i }),
    );
    await Promise.all(saves);

    // Data should be valid JSON and contain one of the values
    const onDisk = JSON.parse(fs.readFileSync(fp, "utf-8"));
    expect(typeof onDisk.counter).toBe("number");
    expect(onDisk.counter).toBeGreaterThanOrEqual(0);
    expect(onDisk.counter).toBeLessThan(50);
  }, 60_000);
});
