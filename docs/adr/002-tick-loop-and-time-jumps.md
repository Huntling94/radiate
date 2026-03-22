# ADR-002: Tick Loop and Time-Jump Strategy

**Status:** Accepted
**Date:** 2026-03-22

## Context

The `tick()` function must handle both real-time updates (1-second deltas during active play) and offline catch-up (deltas up to 604,800 seconds for a week away). The population dynamics include stochastic noise, which means there is no closed-form analytical solution — we must simulate step by step.

## Decision

Fixed-step Euler integration with a sub-tick cap.

- Each call to `tick(state, deltaSec)` subdivides the delta into fixed-size steps (default 1 second)
- Maximum 10,000 sub-ticks per call. If delta exceeds 10,000 seconds, step size increases proportionally (e.g., a week offline = 10,000 steps of ~60s each)
- The tick function is pure: `(WorldState, number) → WorldState`. No side effects, no mutation.
- RNG state is threaded through: restored from `state.rngState` at the start, saved back at the end

## Consequences

**Easier:**
- Any future dynamics (Lotka-Volterra, speciation, environmental effects) slot into the same loop with no architectural change
- Performance is bounded: tick() always completes in predictable time regardless of delta
- Deterministic: same state + same delta + same RNG = same result

**Harder:**
- Long offline periods have lower temporal resolution (60s steps vs 1s steps). Rapid population oscillations within a step are averaged out. Acceptable — the player wasn't watching.
- Very long offline periods (months) would need even larger step sizes. For v0.1, a week is the practical maximum.
