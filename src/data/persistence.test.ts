import { describe, it, expect, beforeEach } from 'vitest';
import { saveWorld, loadWorld, clearWorld } from './persistence.ts';
import { createInitialState } from '../engine/index.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('persistence', () => {
  // T1: Round-trip
  it('saves and loads identical state', () => {
    const state = createInitialState(42);
    saveWorld(state);
    const loaded = loadWorld();

    expect(loaded).not.toBeNull();
    expect(loaded?.tick).toBe(state.tick);
    expect(loaded?.species).toEqual(state.species);
    expect(loaded?.biomes).toEqual(state.biomes);
    expect(loaded?.config).toEqual(state.config);
    expect(loaded?.rngState).toEqual(state.rngState);
  });

  // T2: Empty state
  it('returns null when no save exists', () => {
    expect(loadWorld()).toBeNull();
  });

  // T3: Clear
  it('clears saved state', () => {
    const state = createInitialState(42);
    saveWorld(state);
    expect(loadWorld()).not.toBeNull();

    clearWorld();
    expect(loadWorld()).toBeNull();
  });

  // T4: Version check
  it('saves with version number', () => {
    const state = createInitialState(42);
    saveWorld(state);

    const raw = localStorage.getItem('radiate-world-v1');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!) as { version: number };
    expect(parsed.version).toBe(1);
  });
});
