import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: vi.fn(async () => null),
  getCachedMerchantByDomain: vi.fn(async () => null),
}));

vi.mock('@/lib/validation', () => ({
  isValidMerchantIdentifier: vi.fn(() => true),
  isDomainIdentifier: vi.fn(() => false),
}));

vi.mock('@/components/storefront/ogabassey/pages/wallet', () => ({
  OgabasseyV2Wallet: () => <div data-testid="wallet">Wallet UI</div>,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const { default: WalletPage } = await import('./page');

describe('WalletPage', () => {
  const params = Promise.resolve({ slug: 'test-store' });

  it('renders H1 in the initial synchronous output', () => {
    render(<WalletPage params={params} />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Wallet');
    expect(h1).toHaveClass('sr-only');
  });

  it('renders Suspense fallback while content loads', () => {
    render(<WalletPage params={params} />);

    expect(screen.getByText('Loading wallet...')).toBeInTheDocument();
  });
});
