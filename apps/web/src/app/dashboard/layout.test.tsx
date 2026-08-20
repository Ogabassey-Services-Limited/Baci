import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(({ children }: { children: ReactNode }) => children),
  getTrustedRequestNonce: vi.fn(),
  headers: vi.fn(),
  themeProvider: vi.fn(
    ({ children, nonce }: { children: ReactNode; nonce?: string }) => (
      <section aria-label="Theme Provider" data-nonce={nonce}>
        {children}
      </section>
    )
  ),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('next-themes', () => ({
  ThemeProvider: mocks.themeProvider,
}));

vi.mock('./auth-guard', () => ({
  DashboardAuthGuard: mocks.authGuard,
  getTrustedRequestNonce: mocks.getTrustedRequestNonce,
}));

vi.mock('./loading', () => ({
  default: () => <div data-testid="dashboard-loading" />,
}));

vi.mock('@/components/passkey-enrollment-prompt', () => ({
  PasskeyEnrollmentPrompt: () => null,
}));

import DashboardLayout from './layout';

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue({});
    mocks.getTrustedRequestNonce.mockReturnValue('nonce-123');
    mocks.authGuard.mockImplementation(
      ({ children }: { children: ReactNode }) => children
    );
  });

  it('keeps the loading skeleton inside the theme provider during auth suspense', async () => {
    mocks.authGuard.mockImplementation(() => {
      throw new Promise(() => {
        // Keep the auth guard suspended so the route fallback is rendered.
      });
    });

    const layout = await DashboardLayout({
      children: <main>Dashboard content</main>,
    });

    render(layout);

    const themeProvider = screen.getByRole('region', {
      name: 'Theme Provider',
    });
    expect(themeProvider).toHaveAttribute('data-nonce', 'nonce-123');
    expect(themeProvider).toContainElement(
      screen.getByTestId('dashboard-loading')
    );
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });
});
