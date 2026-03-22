# BRF-010: 3D Terrain — Phase 1

**Phase:** v0.2 "Naturalist" · 3D World View (Phase 1 of 4)
**Commit message:** `add Three.js 3D terrain with biome colouring and orbital camera`

---

## 1. Objective

Replace the 2D canvas biome map with an explorable 3D terrain as the primary world view. This is Phase 1 of the 3D implementation — terrain and camera only. Creatures (Phase 2), player character (Phase 3), and building (Phase 4) follow in subsequent briefs.

### What BRF-010 Delivers

- **3D heightmap terrain** generated from existing biome elevation/moisture data
- **Biome-coloured terrain** — vertex colours derived from biome types (ocean blue, forest green, desert tan, etc.)
- **Orbital camera** — rotate, zoom, pan around the world
- **Directional lighting** with ambient fill — simple day-lit scene
- **Species population indicators** — coloured markers on terrain showing where species live (2D sprites/billboards, not 3D creatures yet)
- **Dashboard as overlay** — existing React panels (species list, event log, chart, tree) toggle as an overlay on top of the 3D canvas
- **Responsive canvas** — fills available space, handles resize

### What BRF-010 Does NOT Deliver

- Creature meshes (Phase 2)
- First/third-person camera or player character (Phase 3)
- Building/placement system (Phase 4)
- Physics (not needed until Phase 3)

### Architecture constraint (DDR-002 resolution)

All Three.js code lives in `src/world3d/`. No Three.js imports outside this directory. Terrain generation logic (heightmap from biomes) is pure TypeScript, not Three.js-coupled. This enables future migration to Babylon.js at the Phase 2→3 boundary (DDR-012).

---

## 2. Architecture Decisions

### Decision 1: `src/world3d/` module structure

```
src/world3d/
  terrain.ts       — Pure TS: biome data → heightmap + colour arrays
  scene.ts         — Three.js scene setup, lighting, camera
  indicators.ts    — Species population billboards on terrain
  World3D.tsx      — React component hosting the Three.js canvas
```

The `terrain.ts` module is pure TypeScript — it converts WorldState biome data into typed arrays (positions, colours) that any 3D engine could consume. Only `scene.ts` and `indicators.ts` import from Three.js.

### Decision 2: Heightmap from biome elevation

Each biome cell in the 12×8 grid has an `elevation` (0–1) and `moisture` (0–1). The terrain mesh maps these to a 3D heightfield:

- x, z = biome grid position (scaled to world units)
- y = `elevation * MAX_HEIGHT` (e.g., elevation 0.8+ = mountain peaks, 0.15- = ocean depth below sea level)
- Ocean biomes render as a flat water plane at y=0

The 12×8 grid is low-resolution. To get smooth terrain, interpolate between grid points — subdivide each cell into a 4×4 sub-grid with bilinear interpolation. This gives a 48×32 vertex mesh (1,536 vertices) — trivial for any GPU.

### Decision 3: Vertex colours from biome types

Rather than texture splatting (complex, Phase 2+ territory), use vertex colours. Each vertex gets the colour of its nearest biome type. The existing `BIOME_COLOURS` record provides the palette. Smooth blending at biome boundaries comes naturally from vertex colour interpolation.

This is simple, performant, and visually effective for the low-poly aesthetic.

### Decision 4: Orbital camera via OrbitControls

Three.js ships `OrbitControls` in its examples/addons. It provides rotate (left-drag), zoom (scroll), and pan (right-drag) out of the box. Target the centre of the terrain.

Constrain:
- Min distance (prevent clipping into terrain)
- Max distance (prevent zooming too far out)
- Min polar angle (prevent looking from below)
- Enable damping for smooth feel

### Decision 5: Dashboard overlay, not side-by-side

The 3D canvas becomes the full-width primary view. The existing React dashboard panels (species list/card, temperature control, event log, chart, phylogenetic tree) render as a toggleable sidebar overlay on top of the canvas. A toggle button shows/hides the dashboard.

This maximises the 3D viewport and creates the "game with HUD" feel described in the vision.

**Layout change:**
```
Before (v0.2 current):
┌─────────────────────┬──────────┐
│  Map + panels       │ Sidebar  │
└─────────────────────┴──────────┘

After (BRF-010):
┌────────────────────────────────┐
│         3D Canvas (full)       │
│                                │
│  ┌──────────┐                  │
│  │ Dashboard │  (toggleable    │
│  │ overlay   │   sidebar)      │
│  │           │                  │
│  └──────────┘                  │
└────────────────────────────────┘
```

### Decision 6: Species indicators as billboard sprites

Simple coloured circles placed on the terrain at biome centres, sized proportionally to population. Trophic-coloured (green/amber/red). These are Three.js `Sprite` objects with a circle texture — they always face the camera.

This gives spatial intuition about where species live without the complexity of creature meshes (Phase 2).

---

## 3. Detailed Design

### 3.1 Terrain generation (pure TypeScript)

```typescript
// src/world3d/terrain.ts

interface TerrainData {
  positions: Float32Array;   // x, y, z for each vertex
  colours: Float32Array;     // r, g, b for each vertex
  indices: Uint16Array;      // triangle indices
  width: number;             // vertices in x
  height: number;            // vertices in z
}

function generateTerrain(
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
  subdivisions: number,     // e.g. 4 — subdivisions per biome cell
): TerrainData
```

The function:
1. Creates a `(gridWidth * subdivisions) × (gridHeight * subdivisions)` vertex grid
2. For each vertex, bilinearly interpolates elevation from the 4 nearest biome centres
3. Maps y = elevation × MAX_HEIGHT (ocean biomes clamped to sea level)
4. Assigns vertex colour from the nearest biome's `BIOME_COLOURS`
5. Generates triangle strip indices

### 3.2 Three.js scene (`src/world3d/scene.ts`)

```typescript
function createScene(canvas: HTMLCanvasElement): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  dispose: () => void;
}
```

Setup:
- `WebGLRenderer` with antialiasing, attached to the canvas
- `PerspectiveCamera` (fov: 60, near: 0.1, far: 1000)
- `DirectionalLight` (sun) + `AmbientLight` (fill)
- `OrbitControls` targeting terrain centre
- Background: dark sky gradient or solid dark colour matching the UI theme

### 3.3 Terrain mesh

```typescript
function createTerrainMesh(data: TerrainData): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colours, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(geometry, material);
}
```

### 3.4 Water plane

A flat semi-transparent blue plane at y=0 representing ocean/sea level:
```typescript
const waterGeometry = new THREE.PlaneGeometry(worldWidth, worldDepth);
const waterMaterial = new THREE.MeshLambertMaterial({
  color: 0x1a6b8a,
  transparent: true,
  opacity: 0.7,
});
```

### 3.5 Species indicators

```typescript
function updateIndicators(
  scene: THREE.Scene,
  species: Species[],
  biomes: Biome[],
  terrainData: TerrainData,
): void
```

For each species, for each biome with population > 0:
- Place a billboard sprite at the biome's terrain position (x, terrainY + offset, z)
- Colour by trophic level
- Scale by `log(population)` relative to max

### 3.6 React component (`src/world3d/World3D.tsx`)

```typescript
interface World3DProps {
  worldState: WorldState;
}
```

- `useRef` for canvas element
- `useEffect` to create/dispose Three.js scene
- `useEffect` to update terrain when biomes change (temperature slider)
- `useEffect` to update indicators when species populations change
- `ResizeObserver` for responsive canvas
- Animation loop via `requestAnimationFrame`

### 3.7 App.tsx layout change

```tsx
<div className="relative h-screen w-screen">
  {/* 3D world — full screen */}
  <World3D worldState={worldState} />

  {/* Header bar — top overlay */}
  <header className="absolute top-0 left-0 right-0 ...">
    {/* existing header content */}
  </header>

  {/* Dashboard toggle */}
  <button className="absolute top-2 right-4 ..." onClick={toggleDashboard}>
    {showDashboard ? 'Hide' : 'Dashboard'}
  </button>

  {/* Dashboard sidebar — right overlay */}
  {showDashboard && (
    <div className="absolute top-12 right-0 bottom-0 w-80 overflow-auto bg-neutral-950/90 ...">
      <TemperatureControl ... />
      {/* species list/card */}
      {/* bottom tabs: events/chart/tree */}
    </div>
  )}
</div>
```

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/world3d/terrain.ts` | **NEW** — Pure TS heightmap + colour generation from biomes | LOW — pure functions, testable |
| `src/world3d/scene.ts` | **NEW** — Three.js scene, camera, lighting setup | MEDIUM — new library integration |
| `src/world3d/indicators.ts` | **NEW** — Species billboard sprites on terrain | LOW |
| `src/world3d/World3D.tsx` | **NEW** — React component hosting Three.js canvas | MEDIUM — lifecycle management |
| `src/App.tsx` | **MODIFIED** — full-screen 3D layout with dashboard overlay | MEDIUM — significant layout change |
| `package.json` | **MODIFIED** — add `three` and `@types/three` | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/*` | No engine changes |
| `src/components/useSimulation.ts` | No simulation changes |
| `src/components/SpeciesList.tsx`, `SpeciesCard.tsx`, etc. | Dashboard components unchanged — just repositioned as overlay |
| `src/components/BiomeMap.tsx` | Kept but no longer rendered in default layout. Available as 2D fallback. |
| `src/data/persistence.ts` | No WorldState changes |

---

## 5. Acceptance Criteria

1. A 3D terrain mesh renders from existing biome elevation data, with biome-coloured vertices.
2. Ocean biomes appear as a flat water plane at sea level.
3. Mountains (elevation > 0.8) are visibly elevated. Valleys and plains are distinct.
4. Orbital camera allows rotation, zoom, and pan around the terrain.
5. Species population indicators appear on the terrain, coloured by trophic level.
6. Indicators update as the simulation ticks (populations grow/shrink, species appear/go extinct).
7. Temperature slider still works — changing temperature updates biome types and terrain colours.
8. Dashboard (species list/card, events, chart, tree) toggles as an overlay sidebar.
9. Canvas responds to window resize.
10. No Three.js imports outside `src/world3d/`.
11. `npm run build` passes.
12. All existing tests pass.

---

## 6. Test Strategy

### Engine tests (terrain.ts — pure TypeScript)

| # | Test | What it verifies |
|---|------|-----------------|
| T1 | generateTerrain returns correct vertex count for given grid + subdivisions | Array sizing |
| T2 | Mountain biomes (elevation > 0.8) produce vertices with y > threshold | Height mapping |
| T3 | Ocean biomes (elevation < 0.15) produce vertices at or below sea level | Ocean depth |
| T4 | Vertex colours match BIOME_COLOURS for each biome type | Colour assignment |
| T5 | All vertex positions are finite (no NaN/Infinity) | Data integrity |

### Manual verification

- Rotate around terrain — smooth camera, no clipping
- Zoom in/out — constrained within limits
- Species indicators visible, correctly coloured, update with simulation
- Temperature change → terrain colours update
- Dashboard overlay toggle works, panels are functional
- Mobile: page loads, camera touch controls work

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Three.js bundle size increases build | LOW | Three.js core is ~150KB gzipped. Tree-shaking via Vite keeps it lean. |
| 12×8 grid produces blocky terrain even with subdivision | MEDIUM | Start with 4× subdivision (48×32 = 1,536 vertices). Increase to 8× if needed (96×64 = 6,144 vertices — still trivial). Can add noise perturbation for organic feel. |
| OrbitControls conflicts with dashboard overlay mouse events | LOW | Dashboard overlay uses `pointer-events: auto` on interactive elements, `pointer-events: none` on the container. Three.js canvas receives events that pass through. |
| Layout change breaks existing UI | MEDIUM | All existing components are preserved — only their container changes. The 2D BiomeMap component is kept as fallback. |

---

*Radiate · BRF-010 · Pre-Implementation Brief · v0.2 "Naturalist" · March 2026*
