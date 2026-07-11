import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  it('shows a "billed in NGN" note independent of the merchant', () => {
    render(<DomainSearchPanel />);

    expect(screen.getByText(/billed in NGN/i)).toBeInTheDocument();
  });

  // Domain prices are platform costs (see `config/domain-pricing.ts`) charged
  // to the merchant's wallet in NGN, never an FX-converted amount — so the
  // panel must always render prices in NGN, regardless of the signed-in
  // merchant's own payout currency.
  it('formats domain prices in NGN', async () => {
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

    render(<DomainSearchPanel />);

    fireEvent.change(screen.getByPlaceholderText(/search for a domain/i), {
      target: { value: 'yodha.in' },
    });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('₦2,500')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        (_, element) => element?.textContent === 'Renews at ₦2,000/yr'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
  });
});
