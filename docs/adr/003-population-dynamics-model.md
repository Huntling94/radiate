# ADR-003: Population Dynamics Model

**Status:** Accepted
**Date:** 2026-03-22

## Context

The simulation needs multi-species population dynamics with predation, competition, and herbivory. The model must scale to 100+ species, work with Euler time-stepping, and produce emergent behaviour (oscillations, extinction, cascades) without scripting.

## Decision

Generalised Lotka-Volterra with trait-derived interaction coefficients and multiplicative stochastic noise.

```
dPi/dt = ri × Pi × (1 - Σj(aij × Pj) / Ki) + noise
```

- Interaction coefficients `aij` are computed from species traits (speed, size, trophic level), not hardcoded
- Noise is multiplicative: `P × σ × gaussian() × sqrt(dt)` — small populations have higher relative variance
- Trophic levels (producer → herbivore → predator) determine food chain structure
- O(species² × biomes) per tick — scales to 100+ species

## Consequences

**Easier:**
- New species from mutation/speciation automatically get interactions from their traits
- Emergent food webs, oscillations, and cascades arise from the equations
- Testable: deterministic given the same seed, known mathematical properties

**Harder:**
- No individual-level behaviour (acceptable for v0.1 — population-level dynamics is the product)
- Euler integration can be unstable with large coefficients — mitigated by per-step population change caps
- Tuning interaction coefficients for "interesting" dynamics requires experimentation
