import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleMerchantReadinessCard } from './google-merchant-readiness-card';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

describe('GoogleMerchantReadinessCard', () => {
  it('renders readiness checks returned from the API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        checks: [
          {
            id: 'support-contact',
            label: 'Support contact',
            severity: 'pass',
            message: 'A public support contact is available.',
          },
          {
            id: 'identifier-coverage',
            label: 'Identifier coverage',
            severity: 'warn',
            message: '0 of 1 products have GTIN or MPN identifiers.',
          },
        ],
        totals: {
          products: 1,
          withBrand: 1,
          withIdentifier: 0,
          withGoogleCategory: 1,
          withVerifiedImage: 1,
        },
      }),
    } as Response);

    render(<GoogleMerchantReadinessCard />);

    expect(await screen.findByText(/1 products checked/i)).toBeInTheDocument();
    expect(screen.getByText('Support contact')).toBeInTheDocument();
    expect(screen.getByText('Identifier coverage')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/integrations/google-merchant-center/readiness'
    );
  });

  it('shows an error state when readiness cannot be loaded', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    render(<GoogleMerchantReadinessCard />);

    expect(
      await screen.findByText('Unable to load Merchant Center readiness')
    ).toBeInTheDocument();
  });
});
