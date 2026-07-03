import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

const mocks = vi.hoisted(() => ({
  captureAdminException: vi.fn(),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      error: '#ff0000',
      primary: '#000000',
      text: '#111111',
      textSecondary: '#444444',
    },
  }),
}));

vi.mock('@/services/analytics-core', () => ({
  captureAdminException: mocks.captureAdminException,
}));

function ThrowingChild(): ReactElement {
  throw new Error('admin render failed');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports caught render errors to admin analytics', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('admin render failed')).toBeTruthy();
    expect(mocks.captureAdminException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        component_stack: expect.any(String),
        route_surface: 'mobile-admin',
      })
    );

    consoleErrorSpy.mockRestore();
  });
});
