import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommerceTrustReadinessCard } from './agent-commerce-trust-readiness-card';

const mockFetch = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

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
            affectedProductIds: ['product-1', 'product-2'],
            id: 'canonical-url-parity',
            label: 'Canonical URL parity',
            severity: 'fail',
            message: '2 products have mismatched canonical URLs.',
          },
          {
            id: 'policy-coverage',
            label: 'Policy coverage',
            severity: 'fail',
            message: 'Add complete return and shipping policies.',
          },
          {
            id: 'structured-data-readiness',
            label: 'Structured data readiness',
            severity: 'pass',
            message: '2 products have core JSON-LD product fields.',
          },
          {
            id: 'feed-freshness',
            label: 'Feed freshness',
            severity: 'pass',
            message: 'Latest product feed timestamp is recent.',
          },
          {
            id: 'crawler-visibility',
            label: 'Crawler visibility',
            severity: 'pass',
            message: 'Robots and sitemap entry points are published.',
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
          latestProductUpdatedAt: '2026-05-10T00:00:00.000Z',
          productsWithStructuredData: 2,
          staleProducts: 0,
        },
      }),
    } as Response);

    render(<AgentCommerceTrustReadinessCard />);

    expect(
      await screen.findByText(/agent trust health has blockers/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Catalog surface parity')).toBeInTheDocument();
    expect(screen.getByText('Canonical URL parity')).toBeInTheDocument();
    expect(screen.getByText('Policy coverage')).toBeInTheDocument();
    expect(screen.getByText('Structured data readiness')).toBeInTheDocument();
    expect(screen.getByText('Feed freshness')).toBeInTheDocument();
    expect(screen.getByText('Crawler visibility')).toBeInTheDocument();
    expect(screen.getByText('Priority fixes')).toBeInTheDocument();
    expect(screen.getByText('Fix product URLs')).toBeInTheDocument();
    expect(screen.getByText('Update policies')).toBeInTheDocument();
    expect(screen.getByText('2 affected products')).toBeInTheDocument();
    expect(screen.getByText('2 affected')).toBeInTheDocument();
    const productUrlAction = screen.getByText('Fix product URLs').closest('li');
    const policyAction = screen.getByText('Update policies').closest('li');
    expect(productUrlAction).toBeTruthy();
    expect(policyAction).toBeTruthy();
    expect(
      within(productUrlAction as HTMLElement).getByRole('link', {
        name: 'Review Fix product URLs',
      })
    ).toHaveAttribute('href', '/dashboard/seo');
    expect(
      within(policyAction as HTMLElement).getByRole('link', {
        name: 'Review Update policies',
      })
    ).toHaveAttribute('href', '/dashboard/settings/trust');
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
