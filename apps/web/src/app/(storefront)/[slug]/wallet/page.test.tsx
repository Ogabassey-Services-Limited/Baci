import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedMerchant } from '@/lib/cached-data';
import { isValidMerchantIdentifier } from '@/lib/validation';

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: vi.fn(),
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

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

const { default: WalletPage } = await import('./page');

describe('WalletPage', () => {
  beforeEach(() => {
    vi.mocked(getCachedMerchant).mockReset();
    vi.mocked(isValidMerchantIdentifier).mockReturnValue(true);
    notFound.mockClear();
  });

  it('renders H1 in the initial synchronous output', () => {
    vi.mocked(getCachedMerchant).mockReturnValue(
      new Promise(() => {
        /* deferred: keep Suspense pending */
      })
    );

    render(<WalletPage params={Promise.resolve({ slug: 'test-store' })} />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Wallet');
    expect(h1).toHaveClass('sr-only');
  });

  it('renders Suspense fallback while content loads', () => {
    vi.mocked(getCachedMerchant).mockReturnValue(
      new Promise(() => {
        /* deferred: keep Suspense pending */
      })
    );

    render(<WalletPage params={Promise.resolve({ slug: 'test-store' })} />);

    expect(screen.getByText('Loading wallet...')).toBeInTheDocument();
  });

  it('triggers notFound when merchant does not exist', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue(null);

    render(<WalletPage params={Promise.resolve({ slug: 'missing' })} />);

    // Wait for the async WalletContent to resolve and call notFound
    await vi.waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });

  it('does not call notFound for valid ogabassey merchant', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      template_id: 'ogabassey',
      slug: 'ogabassey',
    } as unknown as Awaited<ReturnType<typeof getCachedMerchant>>);

    render(<WalletPage params={Promise.resolve({ slug: 'ogabassey' })} />);

    // Allow async WalletContent to resolve
    await vi.waitFor(() => {
      expect(getCachedMerchant).toHaveBeenCalledWith('ogabassey');
    });
    expect(notFound).not.toHaveBeenCalled();
  });

  it('triggers notFound for non-ogabassey template', async () => {
    vi.mocked(getCachedMerchant).mockResolvedValue({
      template_id: 'default',
      slug: 'other-store',
    } as unknown as Awaited<ReturnType<typeof getCachedMerchant>>);

    render(<WalletPage params={Promise.resolve({ slug: 'other-store' })} />);

    await vi.waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });

  it('triggers notFound for invalid slug', async () => {
    vi.mocked(isValidMerchantIdentifier).mockReturnValue(false);

    render(<WalletPage params={Promise.resolve({ slug: 'invalid!!slug' })} />);

    await vi.waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });
});
