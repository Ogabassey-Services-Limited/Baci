import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RootDynamicBody } from './root-dynamic-body';

vi.mock('@/components/analytics/deferred-platform-insights', () => ({
  DeferredPlatformInsights: () => <div>DeferredPlatformInsights</div>,
}));

vi.mock('@/components/analytics/web-vitals-reporter', () => ({
  WebVitalsReporter: () => <div>WebVitalsReporter</div>,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div>Toaster</div>,
}));

const mockProviders = vi.fn(({ children }: { children: ReactNode }) => (
  <div data-testid="providers">{children}</div>
));

vi.mock('@/contexts/providers', () => ({
  Providers: (props: { children: ReactNode }) => mockProviders(props),
}));

const mockNonceProvider = vi.fn(
  ({ children }: { children: ReactNode; nonce?: string }) => (
    <div data-testid="nonce-provider">{children}</div>
  )
);

vi.mock('@/contexts/NonceProvider', () => ({
  NonceProvider: (props: { children: ReactNode; nonce?: string }) =>
    mockNonceProvider(props),
}));

describe('RootDynamicBody', () => {
  it('renders the global root shell around the page content', () => {
    mockNonceProvider.mockClear();
    mockProviders.mockClear();

    render(
      <RootDynamicBody>
        <main>Main content</main>
      </RootDynamicBody>
    );

    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(screen.getByTestId('nonce-provider')).toBeInTheDocument();
    expect(screen.getByTestId('providers')).toBeInTheDocument();
    expect(screen.getByText('Toaster')).toBeInTheDocument();
    expect(screen.getByText('WebVitalsReporter')).toBeInTheDocument();
    expect(screen.getByText('DeferredPlatformInsights')).toBeInTheDocument();
    expect(mockNonceProvider.mock.calls[0]?.[0]).toMatchObject({
      nonce: undefined,
    });
  });

  it('forwards the CSP nonce when provided', () => {
    mockNonceProvider.mockClear();
    mockProviders.mockClear();

    render(
      <RootDynamicBody nonce="nonce-123">
        {<main>Main content</main>}
      </RootDynamicBody>
    );

    expect(mockNonceProvider.mock.calls[0]?.[0]).toMatchObject({
      nonce: 'nonce-123',
    });
    expect(mockProviders).toHaveBeenCalledTimes(1);
  });
});
