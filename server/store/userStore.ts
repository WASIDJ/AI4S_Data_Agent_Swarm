import type { User } from "./types.js";
import { usersStore } from "./index.js";

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const users = new Map<string, User>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function persist(): void {
  usersStore.save({
    _schema_version: 1,
    users: Array.from(users.values()),
  });
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function getAllUsers(): User[] {
  return Array.from(users.values());
}

export function getUserById(id: string): User | undefined {
  return users.get(id);
}

export function getUserByEmail(email: string): User | undefined {
  return Array.from(users.values()).find((u) => u.email === email);
}

export function createUser(user: User): User {
  users.set(user.id, user);
  persist();
  return user;
}

export function updateUser(
  id: string,
  patch: Partial<Omit<User, "id" | "createdAt">>,
): User | undefined {
  const existing = users.get(id);
  if (!existing) return undefined;

  const updated: User = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };
  users.set(id, updated);
  persist();
  return updated;
}

export function deleteUser(id: string): boolean {
  const deleted = users.delete(id);
  if (deleted) persist();
  return deleted;
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/** Load users from disk into memory. Call once at startup. */
export function loadUsers(): void {
  const data = usersStore.getData();
  const list = (data.users as User[]) ?? [];
  users.clear();
  for (const user of list) {
    users.set(user.id, user);
  }
}
