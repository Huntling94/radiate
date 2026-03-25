/**
 * World state persistence — save/load to localStorage.
 * All storage access is through this module. Components never call localStorage directly.
 */

import type { WorldState } from '../engine/index.ts';

const STORAGE_KEY = 'radiate-world-v2';

interface SaveFormat {
  version: number;
  state: WorldState;
}

/** Save the current world state to localStorage. */
export function saveWorld(state: WorldState): void {
  const data: SaveFormat = { version: 2, state };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail on quota exceeded — game continues, just won't persist
  }
}

/** Load a saved world state from localStorage. Returns null if no save exists. */
export function loadWorld(): WorldState | null {
  try {
    // Try v2 format first
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveFormat;
      if (data.version === 2) {
        return data.state;
      }
    }

    // Try v1 format (legacy L-V engine) — cannot migrate, return null for clean restart
    raw = localStorage.getItem('radiate-world-v1');
    if (raw) {
      // Clear old v1 save
      localStorage.removeItem('radiate-world-v1');
      // Return null to trigger new game
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

/** Clear the saved world state. */
export function clearWorld(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('radiate-world-v1');
}
