import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BuilderPage from './page';

vi.mock('@/components/csrf-initializer', () => ({
  CsrfInitializer: () => <div data-testid="csrf-initializer" />,
}));

vi.mock('@/hooks/use-merchant', () => ({
  MerchantProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="merchant-provider">{children}</div>
  ),
}));

vi.mock('@/contexts/storefront-context', () => ({
  StorefrontProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="storefront-provider">{children}</div>
  ),
}));

vi.mock('@/components/builder/copilot-builder-wrapper', () => ({
  CopilotBuilderWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="copilot-builder-wrapper">{children}</div>
  ),
}));

vi.mock('./builder-client', () => ({
  default: () => <div data-testid="builder-client" />,
}));

describe('BuilderPage', () => {
  it('mounts CsrfInitializer for builder mutations', () => {
    render(<BuilderPage />);

    expect(screen.getByTestId('csrf-initializer')).toBeInTheDocument();
    expect(screen.getByTestId('builder-client')).toBeInTheDocument();
  });
});
