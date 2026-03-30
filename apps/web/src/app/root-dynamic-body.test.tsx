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

vi.mock('@/contexts/NonceProvider', () => ({
  NonceProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="nonce-provider">{children}</div>
  ),
}));

vi.mock('@/contexts/providers', () => ({
  Providers: ({ children }: { children: ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}));

describe('RootDynamicBody', () => {
  it('renders the global provider shell without request-bound props', () => {
    render(
      <RootDynamicBody>
        <main>Main content</main>
      </RootDynamicBody>
    );

    expect(screen.getByTestId('nonce-provider')).toBeInTheDocument();
    expect(screen.getByTestId('providers')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Main content');
    expect(screen.getByText('Toaster')).toBeInTheDocument();
    expect(screen.getByText('WebVitalsReporter')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('SpeedInsights')).toBeInTheDocument();
  });
});
