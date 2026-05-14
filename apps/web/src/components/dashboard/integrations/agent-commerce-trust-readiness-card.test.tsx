import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommerceTrustReadinessCard } from './agent-commerce-trust-readiness-card';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

describe('AgentCommerceTrustReadinessCard', () => {
  it('renders agent trust checks returned from the API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        checks: [
          {
            id: 'catalog-surface-parity',
            label: 'Catalog surface parity',
            severity: 'pass',
            message: '2 products are present across feed sources.',
          },
          {
            id: 'policy-coverage',
            label: 'Policy coverage',
            severity: 'fail',
            message: 'Add complete return and shipping policies.',
            affectedProductIds: ['product-1', 'product-2'],
          },
        ],
        status: 'fail',
        surfaces: {},
        totals: {
          googleProducts: 2,
          openAiProducts: 2,
          sharedProducts: 2,
          urlMismatches: 0,
          priceMismatches: 0,
          productsWithVerifiedImages: 1,
        },
      }),
    } as Response);

    render(<AgentCommerceTrustReadinessCard />);

    expect(
      await screen.findByText(/agent trust health has blockers/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Catalog surface parity')).toBeInTheDocument();
    expect(screen.getByText('Policy coverage')).toBeInTheDocument();
    expect(screen.getByText('2 affected products')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/integrations/agent-commerce/readiness'
    );
  });

  it('shows an error state when readiness cannot be loaded', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    render(<AgentCommerceTrustReadinessCard />);

    expect(
      await screen.findByText('Unable to load agent trust health')
    ).toBeInTheDocument();
  });
});
