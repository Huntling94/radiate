import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock World3D to avoid WebGL context in test environment
vi.mock('./world3d/World3D.tsx', () => ({
  World3D: () => null,
}));

import { App } from './App.tsx';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('Radiate')).toBeDefined();
  });
});
