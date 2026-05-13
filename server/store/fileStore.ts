import fs from "node:fs";
import path from "node:path";
import { lock } from "proper-lockfile";
import PQueue from "p-queue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

export interface FileStoreOptions {
  /** Absolute path to the JSON file */
  filePath: string;
  /** Default value when file does not exist */
  defaultValue: Record<string, unknown>;
  /** Current schema version (written into `_schema_version`) */
  currentVersion: number;
  /** Migration functions keyed by *from* version (1 → 2, 2 → 3, …) */
  migrations?: Record<number, MigrationFn>;
}

// ---------------------------------------------------------------------------
// Startup cleanup
// ---------------------------------------------------------------------------

/**
 * Remove stale `.tmp.*` files left over from interrupted safeWrite calls.
 * Safe to call at server startup — these files are never needed.
 */
export async function cleanupTmpFiles(dir: string): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dir);
    for (const entry of entries) {
      if (entry.includes('.tmp.')) {
        await fs.promises.unlink(path.join(dir, entry)).catch(() => {});
      }
    }
  } catch {
    // Directory doesn't exist yet — nothing to clean
  }
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/**
 * Safely write JSON to disk:
 * 1. Acquire file lock (proper-lockfile)
 * 2. Write to `.tmp.<pid>` file
 * 3. `fs.rename` to final path (atomic on most filesystems)
 * 4. Release lock
 */
export async function safeWrite(
  filePath: string,
  data: Record<string, unknown>,
): Promise<void> {
  // Ensure the parent directory exists
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });

  // If the target file doesn't exist yet, create an empty one so that
  // proper-lockfile can lock it (it locks *existing* files).
  if (!fs.existsSync(filePath)) {
    await fs.promises.writeFile(filePath, "{}", "utf-8");
  }

  const release = await lock(filePath, { retries: 5, stale: 10_000 });
  try {
    const tmp = filePath + ".tmp." + process.pid;
    const content = JSON.stringify(data, null, 2) + "\n";
    await fs.promises.writeFile(tmp, content, "utf-8");
    await fs.promises.rename(tmp, filePath);
  } finally {
    await release();
  }
}

/**
 * Load JSON from disk. Returns `defaultValue` (and initialises the file)
 * when the file does not exist or is empty / invalid JSON.
 */
export async function loadJson(
  filePath: string,
  defaultValue: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Ensure parent directory exists
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });

  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    if (!raw.trim()) {
      await safeWrite(filePath, defaultValue);
      return { ...defaultValue };
    }
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // File doesn't exist or invalid JSON — initialise with default
    await safeWrite(filePath, defaultValue);
    return { ...defaultValue };
  }
}

// ---------------------------------------------------------------------------
// Schema migration
// ---------------------------------------------------------------------------

/**
 * Run schema migrations in order from the file's current version up to
 * `targetVersion`. Returns the migrated data and persists the result.
 */
export async function migrate(
  filePath: string,
  data: Record<string, unknown>,
  targetVersion: number,
  migrations: Record<number, MigrationFn>,
): Promise<Record<string, unknown>> {
  let version = (data._schema_version as number) || 1;

  if (version >= targetVersion) {
    return data;
  }

  let current = { ...data };
  while (version < targetVersion) {
    const migrateFn = migrations[version];
    if (migrateFn) {
      current = migrateFn(current);
    }
    version++;
  }

  current._schema_version = targetVersion;
  await safeWrite(filePath, current);
  return current;
}

// ---------------------------------------------------------------------------
// FileStore class (write-serialised via p-queue)
// ---------------------------------------------------------------------------

export class FileStore {
  private readonly filePath: string;
  private readonly defaultValue: Record<string, unknown>;
  private readonly currentVersion: number;
  private readonly migrations: Record<number, MigrationFn>;
  private readonly writeQueue = new PQueue({ concurrency: 1 });

  private data: Record<string, unknown>;

  constructor(options: FileStoreOptions) {
    this.filePath = options.filePath;
    this.defaultValue = options.defaultValue;
    this.currentVersion = options.currentVersion;
    this.migrations = options.migrations ?? {};
    this.data = { ...options.defaultValue };
  }

  /** Load from disk + run migrations. Call once at startup. */
  async load(): Promise<void> {
    this.data = await loadJson(this.filePath, this.defaultValue);
    this.data = await migrate(
      this.filePath,
      this.data,
      this.currentVersion,
      this.migrations,
    );
  }

  /** Get the in-memory data (readonly snapshot). */
  getData(): Readonly<Record<string, unknown>> {
    return this.data;
  }

  /**
   * Replace in-memory data and persist to disk (serialised).
   * The caller should *not* mutate the object after passing it here.
   */
  async save(data: Record<string, unknown>): Promise<void> {
    this.data = { ...data };
    await this.writeQueue.add(() => safeWrite(this.filePath, this.data));
  }

  /** Path of the backing JSON file (useful for diagnostics). */
  get path(): string {
    return this.filePath;
  }
}
