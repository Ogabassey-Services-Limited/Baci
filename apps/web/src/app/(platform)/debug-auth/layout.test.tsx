import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import DebugAuthLayout from './layout';

vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

describe('DebugAuthLayout', () => {
  it('wraps the debug auth route in AuthProvider', () => {
    render(
      <DebugAuthLayout>
        <main>Debug auth content</main>
      </DebugAuthLayout>
    );

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Debug auth content');
  });
});
