import { describe, it, expect } from 'vitest';
import { deriveBiomeType, isHabitable } from './biome.ts';

describe('deriveBiomeType', () => {
  // T12: Known input → correct biome type
  it('returns mountain for high elevation', () => {
    expect(deriveBiomeType(20, 0.9, 0.5)).toBe('mountain');
  });

  it('returns ocean for low elevation', () => {
    expect(deriveBiomeType(20, 0.1, 0.5)).toBe('ocean');
  });

  it('returns tundra for sub-zero temperature', () => {
    expect(deriveBiomeType(-5, 0.5, 0.5)).toBe('tundra');
  });

  it('returns desert for low moisture', () => {
    expect(deriveBiomeType(25, 0.5, 0.2)).toBe('desert');
  });

  it('returns forest for high moisture', () => {
    expect(deriveBiomeType(20, 0.5, 0.7)).toBe('forest');
  });

  it('returns grassland for moderate conditions', () => {
    expect(deriveBiomeType(20, 0.5, 0.45)).toBe('grassland');
  });

  it('prioritises elevation over temperature', () => {
    // Even with sub-zero temp, very high elevation → mountain
    expect(deriveBiomeType(-10, 0.85, 0.5)).toBe('mountain');
  });
});

describe('isHabitable', () => {
  it('ocean is not habitable', () => {
    expect(isHabitable('ocean')).toBe(false);
  });

  it('mountain is not habitable', () => {
    expect(isHabitable('mountain')).toBe(false);
  });

  it('grassland is habitable', () => {
    expect(isHabitable('grassland')).toBe(true);
  });

  it('forest is habitable', () => {
    expect(isHabitable('forest')).toBe(true);
  });

  it('desert is habitable', () => {
    expect(isHabitable('desert')).toBe(true);
  });

  it('tundra is habitable', () => {
    expect(isHabitable('tundra')).toBe(true);
  });
});
