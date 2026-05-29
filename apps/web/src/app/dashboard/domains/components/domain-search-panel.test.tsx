import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import { DomainSearchPanel } from './domain-search-panel';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

describe('DomainSearchPanel', () => {
  it('formats domain prices with the merchant payout currency', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            domain: 'yodha.in',
            tld: '.in',
            available: true,
            price: 2500,
            renewalPrice: 2000,
            category: 'local',
          },
        ],
      }),
    })) as unknown as typeof fetch;

    render(
      <DomainSearchPanel
        merchant={
          {
            id: 'merchant-1',
            business_name: 'Yodha',
            payout_currency: 'INR',
          } as unknown as CachedMerchant
        }
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/search for a domain/i), {
      target: { value: 'yodha.in' },
    });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('₹2,500')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        (_, element) => element?.textContent === 'Renews at ₹2,000/yr'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });

  it('falls back to NGN when merchant payout currency is missing', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            domain: 'demo.com.ng',
            tld: '.com.ng',
            available: true,
            price: 2500,
            renewalPrice: 2000,
            category: 'local',
          },
        ],
      }),
    })) as unknown as typeof fetch;

    render(
      <DomainSearchPanel
        merchant={
          {
            id: 'merchant-1',
            business_name: 'Demo',
            payout_currency: null,
          } as unknown as CachedMerchant
        }
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/search for a domain/i), {
      target: { value: 'demo.com.ng' },
    });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('₦2,500')).toBeInTheDocument();
    });
    expect(screen.queryByText(/₹|INR/)).not.toBeInTheDocument();
  });
});
