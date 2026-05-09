import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardProviders } from './providers';

const appBodyMock = vi.fn(({ children }: { children: React.ReactNode }) => (
  <div data-testid="app-body">{children}</div>
));

vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

vi.mock('next-themes', () => ({
  ThemeProvider: ({
    children,
    nonce,
  }: {
    children: React.ReactNode;
    nonce?: string;
  }) => (
    <div data-nonce={nonce} data-testid="theme-provider">
      {children}
    </div>
  ),
}));

vi.mock('@/contexts/NonceProvider', () => ({
  NonceProvider: ({
    children,
    nonce,
  }: {
    children: React.ReactNode;
    nonce?: string;
  }) => (
    <div data-nonce={nonce} data-testid="nonce-provider">
      {children}
    </div>
  ),
  useNonce: () => ({ nonce: 'nonce-123' }),
}));

vi.mock('@/contexts/MotionNonceProvider', () => ({
  MotionNonceProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="motion-nonce-provider">{children}</div>
  ),
}));

vi.mock('@/components/csrf-initializer', () => ({
  CsrfInitializer: () => <div data-testid="csrf-initializer" />,
}));

vi.mock('@/hooks/use-merchant', () => ({
  MerchantProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="merchant-provider">{children}</div>
  ),
  useMerchant: () => ({ merchant: null }),
}));

vi.mock('@/contexts/product-context', () => ({
  ProductProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="product-provider">{children}</div>
  ),
}));

vi.mock('./client-layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="client-layout">{children}</div>
  ),
}));

vi.mock('@/components/app-body', () => ({
  default: (props: { children: React.ReactNode }) => appBodyMock(props),
}));

describe('DashboardProviders', () => {
  beforeEach(() => {
    appBodyMock.mockClear();
  });

  it('renders children within provider tree', () => {
    render(
      <DashboardProviders>
        <div data-testid="child-content">Dashboard Content</div>
      </DashboardProviders>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('wraps children in NonceProvider', () => {
    render(
      <DashboardProviders nonce="nonce-123">
        <div>Content</div>
      </DashboardProviders>
    );

    const nonceProvider = screen.getByTestId('nonce-provider');
    expect(nonceProvider).toHaveAttribute('data-nonce', 'nonce-123');
    expect(nonceProvider).toContainElement(screen.getByTestId('auth-provider'));
    expect(nonceProvider).toContainElement(screen.getByText('Content'));
  });

  it('forwards the nonce to ThemeProvider', () => {
    render(
      <DashboardProviders nonce="nonce-123">
        <div>Content</div>
      </DashboardProviders>
    );

    expect(screen.getByTestId('theme-provider')).toHaveAttribute(
      'data-nonce',
      'nonce-123'
    );
  });

  it('mounts CsrfInitializer for CSRF token initialization', () => {
    render(
      <DashboardProviders>
        <div>Content</div>
      </DashboardProviders>
    );

    expect(screen.getByTestId('csrf-initializer')).toBeInTheDocument();
  });

  it('wraps children in AuthProvider', () => {
    render(
      <DashboardProviders>
        <div>Content</div>
      </DashboardProviders>
    );

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('wraps children in ThemeProvider', () => {
    render(
      <DashboardProviders>
        <div>Content</div>
      </DashboardProviders>
    );

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  });

  it('opts the dashboard route into Framer nonce support', () => {
    render(
      <DashboardProviders>
        <div>Content</div>
      </DashboardProviders>
    );

    expect(screen.getByTestId('motion-nonce-provider')).toBeInTheDocument();
  });

  it('wraps children in MerchantProvider', () => {
    render(
      <DashboardProviders>
        <div>Content</div>
      </DashboardProviders>
    );

    expect(screen.getByTestId('merchant-provider')).toBeInTheDocument();
  });

  it('wraps children in ProductProvider', () => {
    render(
      <DashboardProviders>
        <div>Content</div>
      </DashboardProviders>
    );

    expect(screen.getByTestId('product-provider')).toBeInTheDocument();
  });

  it('disables storefront overlays inside the dashboard shell', () => {
    render(
      <DashboardProviders>
        <div>Content</div>
      </DashboardProviders>
    );

    expect(appBodyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        applyMerchantCoreThemeVariables: false,
        showCookieConsent: false,
        showNewsletterWidget: false,
      })
    );
  });
});
