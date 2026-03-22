/**
 * Vitest test setup — polyfills for jsdom environment.
 * Canvas and ResizeObserver are not available in jsdom.
 */

// Polyfill ResizeObserver (used by Recharts ResponsiveContainer)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Stub HTMLCanvasElement.getContext (used by BiomeMap)
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
}
