import { describe, it, expect } from 'vitest';
import { createSpatialHash } from './spatial-hash.ts';
import type { SpatialEntry } from './spatial-hash.ts';

interface TestEntry extends SpatialEntry {
  id: string;
  x: number;
  z: number;
  label: string;
}

function makeEntry(id: string, x: number, z: number, label = ''): TestEntry {
  return { id, x, z, label };
}

describe('SpatialHash', () => {
  it('inserts and queries a single entry', () => {
    const hash = createSpatialHash<TestEntry>(10);
    hash.insert(makeEntry('a', 5, 5));

    const results = hash.query(5, 5, 1);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a');
  });

  it('returns only entries within radius', () => {
    const hash = createSpatialHash<TestEntry>(10);
    hash.insert(makeEntry('near', 5, 5));
    hash.insert(makeEntry('far', 100, 100));

    const results = hash.query(5, 5, 10);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('near');
  });

  it('returns multiple entries within radius', () => {
    const hash = createSpatialHash<TestEntry>(10);
    hash.insert(makeEntry('a', 0, 0));
    hash.insert(makeEntry('b', 3, 4)); // distance = 5
    hash.insert(makeEntry('c', 6, 8)); // distance = 10

    const results = hash.query(0, 0, 10);
    expect(results).toHaveLength(3);
  });

  it('returns empty array for empty hash', () => {
    const hash = createSpatialHash<TestEntry>(10);
    const results = hash.query(0, 0, 100);
    expect(results).toHaveLength(0);
  });

  it('removes an entry', () => {
    const hash = createSpatialHash<TestEntry>(10);
    hash.insert(makeEntry('a', 5, 5));
    hash.insert(makeEntry('b', 6, 6));

    hash.remove('a');
    const results = hash.query(5, 5, 5);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('b');
  });

  it('tracks size correctly through insert and remove', () => {
    const hash = createSpatialHash<TestEntry>(10);
    expect(hash.size).toBe(0);

    hash.insert(makeEntry('a', 0, 0));
    hash.insert(makeEntry('b', 1, 1));
    expect(hash.size).toBe(2);

    hash.remove('a');
    expect(hash.size).toBe(1);

    hash.remove('nonexistent');
    expect(hash.size).toBe(1);
  });

  it('clears all entries', () => {
    const hash = createSpatialHash<TestEntry>(10);
    hash.insert(makeEntry('a', 0, 0));
    hash.insert(makeEntry('b', 50, 50));

    hash.clear();
    expect(hash.size).toBe(0);
    expect(hash.query(0, 0, 1000)).toHaveLength(0);
  });

  it('handles entries at negative coordinates', () => {
    const hash = createSpatialHash<TestEntry>(10);
    hash.insert(makeEntry('neg', -15, -25));

    const results = hash.query(-15, -25, 1);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('neg');
  });

  it('handles entries across cell boundaries', () => {
    const hash = createSpatialHash<TestEntry>(10);
    // Place entries on either side of a cell boundary
    hash.insert(makeEntry('a', 9, 0));
    hash.insert(makeEntry('b', 11, 0));

    // Query centred at the boundary — both should be within radius 5
    const results = hash.query(10, 0, 5);
    expect(results).toHaveLength(2);
  });

  it('nearest returns the closest entry', () => {
    const hash = createSpatialHash<TestEntry>(10);
    hash.insert(makeEntry('far', 10, 0));
    hash.insert(makeEntry('near', 3, 0));

    const result = hash.nearest(0, 0, 20);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('near');
  });

  it('nearest returns null when no entries match', () => {
    const hash = createSpatialHash<TestEntry>(10);
    hash.insert(makeEntry('far', 100, 100));

    const result = hash.nearest(0, 0, 5);
    expect(result).toBeNull();
  });

  it('nearest respects predicate filter', () => {
    const hash = createSpatialHash<TestEntry>(10);
    hash.insert(makeEntry('a', 1, 0, 'prey'));
    hash.insert(makeEntry('b', 2, 0, 'predator'));
    hash.insert(makeEntry('c', 3, 0, 'prey'));

    const result = hash.nearest(0, 0, 10, (e) => e.label === 'predator');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('b');
  });

  it('handles large number of insertions', () => {
    const hash = createSpatialHash<TestEntry>(20);
    for (let i = 0; i < 500; i++) {
      hash.insert(makeEntry(`e${String(i)}`, Math.random() * 200 - 100, Math.random() * 200 - 100));
    }
    expect(hash.size).toBe(500);

    // Query should return a subset
    const results = hash.query(0, 0, 10);
    expect(results.length).toBeLessThanOrEqual(500);
    // All results should actually be within radius
    for (const r of results) {
      const dist = Math.sqrt(r.x * r.x + r.z * r.z);
      expect(dist).toBeLessThanOrEqual(10 + 0.001); // small epsilon for float comparison
    }
  });
});
