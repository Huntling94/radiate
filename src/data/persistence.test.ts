import { describe, it, expect, beforeEach } from 'vitest';
import { saveWorld, loadWorld, clearWorld } from './persistence.ts';
import { createInitialState } from '../engine/index.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('persistence', () => {
  it('round-trips a WorldState through save and load', () => {
    const state = createInitialState(42);
    saveWorld(state);
    const loaded = loadWorld();

    expect(loaded).not.toBeNull();
    expect(loaded?.tick).toBe(state.tick);
    expect(loaded?.creatures.length).toBe(state.creatures.length);
    expect(loaded?.speciesClusters.length).toBe(state.speciesClusters.length);
    expect(loaded?.biomes).toEqual(state.biomes);
    expect(loaded?.config).toEqual(state.config);
  });

  it('returns null when no save exists', () => {
    expect(loadWorld()).toBeNull();
  });

  it('clears saved state', () => {
    const state = createInitialState(42);
    saveWorld(state);
    expect(loadWorld()).not.toBeNull();

    clearWorld();
    expect(loadWorld()).toBeNull();
  });

  it('saves with version 2', () => {
    const state = createInitialState(42);
    saveWorld(state);

    const raw = localStorage.getItem('radiate-world-v2');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!) as { version: number };
    expect(parsed.version).toBe(2);
  });

  it('v1 saves return null and are cleaned up', () => {
    localStorage.setItem('radiate-world-v1', JSON.stringify({ version: 1, state: { tick: 100 } }));
    expect(loadWorld()).toBeNull();
    expect(localStorage.getItem('radiate-world-v1')).toBeNull();
  });
});
