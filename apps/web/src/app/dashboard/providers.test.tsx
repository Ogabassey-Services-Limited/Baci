import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardProviders } from './providers';

// Mock all provider dependencies to avoid deep rendering
vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

vi.mock('@/contexts/NonceProvider', () => ({
  useNonce: () => ({ nonce: 'nonce-123' }),
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
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-body">{children}</div>
  ),
}));

describe('DashboardProviders', () => {
  it('renders children within provider tree', () => {
    render(
      <DashboardProviders>
        <div data-testid="child-content">Dashboard Content</div>
      </DashboardProviders>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
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
});
