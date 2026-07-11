import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedMerchant } from '@/lib/cached-data';

vi.mock('@/components/storefront/ogabassey/pages/unlock-orders', () => ({
  OgabasseyUnlockOrders: () => <div>Unlock order tracker</div>,
}));
vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: vi.fn(),
  getCachedMerchantByDomain: vi.fn(async () => null),
}));
vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: vi.fn(() => false),
  isValidMerchantIdentifier: vi.fn(() => true),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

const { default: UnlockOrdersPage, metadata } = await import('./page');

describe('UnlockOrdersPage', () => {
  beforeEach(() => {
    vi.mocked(getCachedMerchant).mockReset();
  });

  it('renders only for the supported merchant template', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      template_id: 'ogabassey',
    } as never);

    render(
      await UnlockOrdersPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    expect(screen.getByText('Unlock order tracker')).toBeInTheDocument();
    expect(metadata.robots).toEqual({ follow: false, index: false });
  });
});
