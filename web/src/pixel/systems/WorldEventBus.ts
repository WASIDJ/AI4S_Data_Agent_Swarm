/**
 * WorldEventBus — singleton event bus for React <-> Phaser communication.
 *
 * React → Phaser events:
 *   agent:added, agent:updated, agent:removed,
 *   task:updated, event:new, select:agent, camera:focus
 *
 * Phaser → React events:
 *   agent:clicked, scene:ready
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

class WorldEventBus {
  private listeners: Map<string, Set<Listener>> = new Map();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event: string, fn: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }

  /** Subscribe to an event for a single invocation. */
  once(event: string, fn: Listener): () => void {
    const wrapper: Listener = (...args) => {
      unsub();
      fn(...args);
    };
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  /** Emit an event to all listeners. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Iterate over a snapshot so listeners can unsubscribe during iteration
    for (const fn of [...set]) {
      fn(...args);
    }
  }

  /** Remove all listeners. Call this when the Phaser game is destroyed. */
  removeAll(): void {
    this.listeners.clear();
  }
}

/** Global singleton shared between React components and Phaser scenes. */
export const worldEventBus = new WorldEventBus();
