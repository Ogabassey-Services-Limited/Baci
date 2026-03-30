import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RootDynamicBody } from './root-dynamic-body';

vi.mock('@vercel/analytics/next', () => ({
  Analytics: () => <div>Analytics</div>,
}));

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => <div>SpeedInsights</div>,
}));

vi.mock('@/components/analytics/web-vitals-reporter', () => ({
  WebVitalsReporter: () => <div>WebVitalsReporter</div>,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div>Toaster</div>,
}));

const mockNonceProvider = vi.fn(
  ({ children }: { children: ReactNode; nonce?: string }) => (
    <div>{children}</div>
  )
);

vi.mock('@/contexts/NonceProvider', () => ({
  NonceProvider: (props: { children: ReactNode; nonce?: string }) =>
    mockNonceProvider(props),
}));

const mockProviders = vi.fn(
  ({ children }: { children: ReactNode; forcedTheme?: string }) => (
    <div>{children}</div>
  )
);

vi.mock('@/contexts/providers', () => ({
  Providers: (props: { children: ReactNode; forcedTheme?: string }) =>
    mockProviders(props),
}));

describe('RootDynamicBody', () => {
  it('renders the global provider shell without extra props', () => {
    mockNonceProvider.mockClear();
    mockProviders.mockClear();

    render(
      <RootDynamicBody>
        <main>Main content</main>
      </RootDynamicBody>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(screen.getByText('Toaster')).toBeInTheDocument();
    expect(screen.getByText('WebVitalsReporter')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('SpeedInsights')).toBeInTheDocument();

    expect(mockNonceProvider).toHaveBeenCalledTimes(1);
    expect(mockNonceProvider.mock.calls[0]?.[0]).toMatchObject({
      nonce: undefined,
    });
    expect(mockProviders).toHaveBeenCalledTimes(1);
    expect(mockProviders.mock.calls[0]?.[0]).toMatchObject({
      forcedTheme: undefined,
    });
  });

  it('forwards nonce and forcedTheme when provided', () => {
    mockNonceProvider.mockClear();
    mockProviders.mockClear();

    render(
      <RootDynamicBody nonce="nonce-123" forcedTheme="light">
        <main>Main content</main>
      </RootDynamicBody>
    );

    expect(mockNonceProvider.mock.calls[0]?.[0]).toMatchObject({
      nonce: 'nonce-123',
    });
    expect(mockProviders.mock.calls[0]?.[0]).toMatchObject({
      forcedTheme: 'light',
    });
  });
});
