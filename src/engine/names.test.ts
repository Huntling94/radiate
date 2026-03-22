import { describe, it, expect } from 'vitest';
import { generateSpeciesName } from './names.ts';
import { createRng } from './rng.ts';

describe('generateSpeciesName', () => {
  // T14: Determinism
  it('produces the same name from the same seed', () => {
    const name1 = generateSpeciesName(createRng(42));
    const name2 = generateSpeciesName(createRng(42));
    expect(name1).toBe(name2);
  });

  // T15: Variety
  it('produces different names from different seeds', () => {
    const names = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      names.add(generateSpeciesName(createRng(seed)));
    }
    // Should have at least 10 unique names out of 20
    expect(names.size).toBeGreaterThanOrEqual(10);
  });

  it('produces non-empty strings', () => {
    for (let seed = 0; seed < 10; seed++) {
      const name = generateSpeciesName(createRng(seed));
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
