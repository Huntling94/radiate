/**
 * Tunable constants for the Individual-Based Model (IBM) engine.
 *
 * All simulation-affecting constants live here for easy tuning.
 * Each constant includes a rationale comment explaining the value.
 *
 * BRF-016: IBM Engine Core
 */

// ---------------------------------------------------------------------------
// World grid
// ---------------------------------------------------------------------------

/** Default biome grid width (columns). 25×25 = 625 biomes, ~400 habitable. */
export const DEFAULT_GRID_WIDTH = 25;

/** Default biome grid height (rows). */
export const DEFAULT_GRID_HEIGHT = 25;

/** World units per biome cell. Matches terrain.ts CELL_SIZE. */
export const CELL_SIZE = 10;

// ---------------------------------------------------------------------------
// Energy — producer photosynthesis
// ---------------------------------------------------------------------------

/**
 * Energy gained by a producer per tick from photosynthesis.
 * Scaled by biome energy fraction and fitness.
 *
 * At avg genome (size=0.4, metabolism=0.3), net gain ≈ 0.49/tick.
 * → ~200 ticks to reach reproduction threshold.
 * → Avg producer reproduces once per lifetime (lifespan ~300 ticks).
 */
export const PRODUCER_ENERGY_GAIN = 0.5;

/**
 * Maximum biome energy value used to normalise producer energy gain.
 * A forest at optimal conditions: 1000 × 1.5 (moisture) × 1.0 (temp) = 1500.
 */
export const MAX_BIOME_ENERGY = 1500;

// ---------------------------------------------------------------------------
// Energy — metabolism
// ---------------------------------------------------------------------------

/**
 * Per-tick energy cost of being alive: BASE_METABOLISM_COST × size × metabolism.
 *
 * Range: 0.001 (tiny efficient creature) to 0.4 (large hungry creature).
 * Creates selection pressure on body size and metabolism traits.
 */
export const BASE_METABOLISM_COST = 0.1;

// ---------------------------------------------------------------------------
// Energy — reproduction
// ---------------------------------------------------------------------------

/**
 * Energy required before a creature can reproduce.
 * Producer at avg genome: ~200 ticks to accumulate.
 * Herbivores reach it through ~7 meals (15 energy each).
 * Predators reach it through ~4 meals (25 energy each).
 */
export const REPRODUCTION_ENERGY_THRESHOLD = 100;

/**
 * Energy given to the offspring at birth.
 * 40% of threshold — offspring is viable but not immediately reproductive.
 */
export const OFFSPRING_STARTING_ENERGY = 40;

/**
 * Total energy deducted from parent on reproduction.
 * Parent retains threshold - cost = 50 energy after reproducing,
 * allowing it to reproduce again without starting from zero.
 */
export const REPRODUCTION_ENERGY_COST = 50;

// ---------------------------------------------------------------------------
// Energy — feeding
// ---------------------------------------------------------------------------

/**
 * Energy gained by a herbivore when it eats a producer.
 * Herbivore needs ~7 meals to reach reproduction threshold.
 */
export const HERBIVORE_FEED_ENERGY = 15;

/**
 * Energy gained by a predator when it catches a herbivore.
 * Higher than herbivore feeding because prey is rarer and harder to catch.
 * Predator needs ~4 meals to reach reproduction threshold.
 */
export const PREDATOR_FEED_ENERGY = 25;

// ---------------------------------------------------------------------------
// Detection and movement
// ---------------------------------------------------------------------------

/** World units within which a herbivore detects food (producers). */
export const HERBIVORE_DETECTION_RANGE = 15;

/** World units within which a predator detects prey (herbivores). */
export const PREDATOR_DETECTION_RANGE = 20;

/** World units at which prey detects an approaching predator and flees. */
export const FLEE_DETECTION_RANGE = 12;

/**
 * Base movement speed in world units per tick.
 * Multiplied by the creature's speed trait (0.1–2.0).
 * At speed trait 1.0: 0.5 units/tick = 0.5 units/sec at 1x speed.
 */
export const BASE_MOVE_SPEED = 0.5;

/** Speed multiplier when fleeing from a predator. */
export const FLEE_SPEED_MULTIPLIER = 1.5;

/** Speed multiplier when chasing prey. */
export const CHASE_SPEED_MULTIPLIER = 1.3;

/** Distance threshold for feeding — creature must be this close to eat. */
export const FEED_DISTANCE = 2;

/** Number of ticks a herbivore flees before reassessing. */
export const FLEE_DURATION = 5;

/** Number of ticks a predator chases before giving up. */
export const CHASE_TIMEOUT = 10;

/** Wander radius for idle creatures (world units). */
export const WANDER_RADIUS = 8;

// ---------------------------------------------------------------------------
// Lifespan
// ---------------------------------------------------------------------------

/**
 * Base lifespan in ticks, modified by genome traits.
 *
 * Formula: BASE + size × SIZE_FACTOR + metabolism × METABOLISM_FACTOR
 * Min clamped to MINIMUM_LIFESPAN.
 *
 * Examples:
 *   Small efficient (size=0.2, metabolism=0.2): 300 + (-10) + (-16) = 274
 *   Average (size=0.5, metabolism=0.5):         300 + (-25) + (-40) = 235
 *   Large hungry (size=1.5, metabolism=1.5):    300 + (-75) + (-120) = 105 → clamped to 50
 *   Large hungry (size=2.0, metabolism=2.0):    300 + (-100) + (-160) = 40 → clamped to 50
 */
export const BASE_LIFESPAN = 300;

/** Larger creatures live shorter lives. Per unit of size trait. */
export const LIFESPAN_SIZE_FACTOR = -50;

/** Higher metabolism shortens lifespan. Per unit of metabolism trait. */
export const LIFESPAN_METABOLISM_FACTOR = -80;

/** Absolute minimum lifespan regardless of genome. */
export const MINIMUM_LIFESPAN = 50;

// ---------------------------------------------------------------------------
// Producers — sessile creatures
// ---------------------------------------------------------------------------

/**
 * Maximum producer creatures per biome cell.
 * Bounds total producer count: 625 biomes × 20 = 12,500 theoretical max.
 * Realistically 2,000–5,000 depending on biome types.
 */
export const PRODUCER_DENSITY_CAP = 20;

/** Offspring appear within this radius of the parent (world units). */
export const PRODUCER_SPAWN_RADIUS = 5;

// ---------------------------------------------------------------------------
// Spatial hash
// ---------------------------------------------------------------------------

/**
 * Cell size for the spatial hash grid (world units).
 * Must be >= max detection range to guarantee O(1) neighbour queries.
 * PREDATOR_DETECTION_RANGE = 20, so 20 is the minimum.
 */
export const SPATIAL_HASH_CELL_SIZE = 20;

// ---------------------------------------------------------------------------
// Genome clustering (speciation)
// ---------------------------------------------------------------------------

/**
 * Re-cluster every N ticks.
 * At 1 tick/sec, this is every ~100 seconds (~2 minutes).
 * Species labels update at this frequency.
 */
export const CLUSTERING_INTERVAL = 100;

/**
 * Maximum genetic distance (Euclidean in 6D trait space) for two creatures
 * to be considered the same species.
 *
 * For reference, geneticDistance between the three seed species:
 *   Proto Alga vs Grazer ≈ 0.9, Grazer vs Stalker ≈ 0.8
 * Threshold of 0.8 means seed species start as distinct clusters.
 */
export const CLUSTERING_DISTANCE_THRESHOLD = 0.8;

/** Minimum creatures to form a recognised species cluster. */
export const MIN_CLUSTER_SIZE = 2;

// ---------------------------------------------------------------------------
// Initial population
// ---------------------------------------------------------------------------

/** Total starting creatures. Split across trophic levels. */
export const INITIAL_CREATURE_COUNT = 100;

/** Fraction of initial creatures that are producers (50). */
export const INITIAL_PRODUCER_FRACTION = 0.5;

/** Fraction of initial creatures that are herbivores (30). */
export const INITIAL_HERBIVORE_FRACTION = 0.3;

/** Fraction of initial creatures that are predators (20). */
export const INITIAL_PREDATOR_FRACTION = 0.2;

/** Starting energy for all seed creatures. */
export const INITIAL_CREATURE_ENERGY = 60;

// ---------------------------------------------------------------------------
// Tick loop
// ---------------------------------------------------------------------------

/**
 * Maximum sub-ticks per tick() call.
 * Caps offline catch-up computation. At 1 tick/sec, 10,000 = ~2.8 hours.
 */
export const MAX_SUB_TICKS = 10_000;
