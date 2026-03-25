/**
 * Grid-based spatial hash for O(1) amortised neighbour queries.
 *
 * Divides the world into cells of a fixed size. Each creature is stored
 * in the cell corresponding to its position. Querying for neighbours
 * only checks the 3×3 grid of cells around the query position.
 *
 * BRF-016: IBM Engine Core
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpatialEntry {
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

export interface SpatialHash<T extends SpatialEntry> {
  /** Insert an entry into the hash. */
  insert(entry: T): void;
  /** Remove an entry by ID. */
  remove(id: string): void;
  /** Query all entries within radius of (x, z). */
  query(x: number, z: number, radius: number): T[];
  /** Find the nearest entry to (x, z) within radius, optionally filtered. */
  nearest(x: number, z: number, radius: number, predicate?: (entry: T) => boolean): T | null;
  /** Remove all entries. */
  clear(): void;
  /** Number of entries in the hash. */
  readonly size: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function cellKey(cx: number, cz: number): string {
  return `${String(cx)},${String(cz)}`;
}

export function createSpatialHash<T extends SpatialEntry>(cellSize: number): SpatialHash<T> {
  const cells = new Map<string, T[]>();
  const entryCell = new Map<string, string>(); // entry ID → cell key
  let entryCount = 0;

  function toCellCoord(v: number): number {
    return Math.floor(v / cellSize);
  }

  function insert(entry: T): void {
    const key = cellKey(toCellCoord(entry.x), toCellCoord(entry.z));
    let bucket = cells.get(key);
    if (!bucket) {
      bucket = [];
      cells.set(key, bucket);
    }
    bucket.push(entry);
    entryCell.set(entry.id, key);
    entryCount++;
  }

  function remove(id: string): void {
    const key = entryCell.get(id);
    if (key === undefined) return;

    const bucket = cells.get(key);
    if (bucket) {
      const idx = bucket.findIndex((e) => e.id === id);
      if (idx >= 0) {
        bucket.splice(idx, 1);
        if (bucket.length === 0) cells.delete(key);
        entryCount--;
      }
    }
    entryCell.delete(id);
  }

  function query(x: number, z: number, radius: number): T[] {
    const results: T[] = [];
    const r2 = radius * radius;

    // Check all cells that could overlap the query circle
    const minCX = toCellCoord(x - radius);
    const maxCX = toCellCoord(x + radius);
    const minCZ = toCellCoord(z - radius);
    const maxCZ = toCellCoord(z + radius);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const bucket = cells.get(cellKey(cx, cz));
        if (!bucket) continue;

        for (const entry of bucket) {
          const dx = entry.x - x;
          const dz = entry.z - z;
          if (dx * dx + dz * dz <= r2) {
            results.push(entry);
          }
        }
      }
    }

    return results;
  }

  function nearest(
    x: number,
    z: number,
    radius: number,
    predicate?: (entry: T) => boolean,
  ): T | null {
    let best: T | null = null;
    let bestDist2 = radius * radius;

    const minCX = toCellCoord(x - radius);
    const maxCX = toCellCoord(x + radius);
    const minCZ = toCellCoord(z - radius);
    const maxCZ = toCellCoord(z + radius);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const bucket = cells.get(cellKey(cx, cz));
        if (!bucket) continue;

        for (const entry of bucket) {
          if (predicate && !predicate(entry)) continue;
          const dx = entry.x - x;
          const dz = entry.z - z;
          const dist2 = dx * dx + dz * dz;
          if (dist2 <= bestDist2) {
            bestDist2 = dist2;
            best = entry;
          }
        }
      }
    }

    return best;
  }

  function clear(): void {
    cells.clear();
    entryCell.clear();
    entryCount = 0;
  }

  return {
    insert,
    remove,
    query,
    nearest,
    clear,
    get size() {
      return entryCount;
    },
  };
}
