import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOgabasseyLayoutStyle: vi.fn(),
}));

vi.mock('@/components/storefront/ogabassey/components/GadgetPattern', () => ({
  GadgetPattern: () => <div data-testid="gadget-pattern" />,
}));

vi.mock(
  '@/components/storefront/ogabassey/storefront-layout-providers',
  () => ({
    OgabasseyLayoutProviders: ({ children }: { children: ReactNode }) => (
      <div data-testid="layout-providers">{children}</div>
    ),
  })
);

vi.mock('@/components/storefront/ogabassey/storefront-layout-utils', () => ({
  getOgabasseyLayoutStyle: (...args: unknown[]) =>
    mocks.getOgabasseyLayoutStyle(...args),
}));

import { StorefrontShellLayout } from './storefront-shell-layout';

describe('StorefrontShellLayout', () => {
  beforeEach(() => {
    mocks.getOgabasseyLayoutStyle.mockReset();
    mocks.getOgabasseyLayoutStyle.mockReturnValue({
      '--store-primary': '#d62027',
    });
  });

  it('renders the shared shell frame around independent content and chrome slots', () => {
    render(
      <StorefrontShellLayout
        merchant={{
          id: 'merchant-1',
          user_id: '',
          business_name: 'Ogabassey',
          business_type: 'electronics',
          slug: 'ogabassey',
        }}
        headerChrome={<div data-testid="header-slot" />}
        footerChrome={<div data-testid="footer-slot" />}
        overlayChrome={<div data-testid="overlay-slot" />}
      >
        <div>Storefront body</div>
      </StorefrontShellLayout>
    );

    expect(screen.getByTestId('layout-providers')).toBeInTheDocument();
    expect(screen.getByTestId('gadget-pattern')).toBeInTheDocument();
    expect(screen.getByTestId('header-slot')).toBeInTheDocument();
    expect(screen.getByText('Storefront body')).toBeInTheDocument();
    expect(screen.getByTestId('footer-slot')).toBeInTheDocument();
    expect(screen.getByTestId('overlay-slot')).toBeInTheDocument();
  });

  it('renders route content when optional chrome slots are omitted', () => {
    render(
      <StorefrontShellLayout>
        <div>Storefront body</div>
      </StorefrontShellLayout>
    );

    expect(screen.getByTestId('layout-providers')).toBeInTheDocument();
    expect(screen.getByTestId('gadget-pattern')).toBeInTheDocument();
    expect(screen.getByText('Storefront body')).toBeInTheDocument();
    expect(screen.queryByTestId('header-slot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('footer-slot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overlay-slot')).not.toBeInTheDocument();
  });
});
