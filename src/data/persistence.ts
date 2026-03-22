/**
 * World state persistence — save/load to localStorage.
 * All storage access is through this module. Components never call localStorage directly.
 */

import type { WorldState } from '../engine/index.ts';

const STORAGE_KEY = 'radiate-world-v1';

interface SaveFormat {
  version: number;
  state: WorldState;
}

/** Save the current world state to localStorage. */
export function saveWorld(state: WorldState): void {
  const data: SaveFormat = { version: 1, state };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail on quota exceeded — game continues, just won't persist
  }
}

/** Load a saved world state from localStorage. Returns null if no save exists. */
export function loadWorld(): WorldState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as SaveFormat;
    if (data.version !== 1) return null;

    return data.state;
  } catch {
    return null;
  }
}

/** Clear the saved world state. */
export function clearWorld(): void {
  localStorage.removeItem(STORAGE_KEY);
}
