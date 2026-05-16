import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AgentCommerceTrustReadinessSummary } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { AgenticTrustCenterCard } from './agentic-trust-center-card';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const baseReadiness: AgentCommerceTrustReadinessSummary = {
  checks: [
    {
      id: 'catalog-surface-parity',
      label: 'Catalog surface parity',
      message: 'Catalog is present.',
      severity: 'pass',
    },
  ],
  status: 'pass',
  totals: {
    googleProducts: 4,
    latestProductUpdatedAt: '2026-05-15T00:00:00.000Z',
    openAiProducts: 4,
    priceMismatches: 0,
    productsWithStructuredData: 4,
    productsWithVerifiedImages: 4,
    sharedProducts: 4,
    staleProducts: 0,
    urlMismatches: 0,
  },
};

describe('AgenticTrustCenterCard', () => {
  it('renders trust status for healthy readiness', () => {
    render(<AgenticTrustCenterCard readiness={baseReadiness} state="ready" />);

    expect(screen.getByText('Agent trust center')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(
      screen.getByText('No trust issues require action right now.')
    ).toBeInTheDocument();
  });

  it('renders top trust fixes with review links when readiness has blockers', () => {
    const readinessWithBlockers = {
      ...baseReadiness,
      checks: [
        {
          id: 'canonical-url-parity',
          label: 'Canonical URL parity',
          message: 'URL mismatches found.',
          severity: 'fail',
        },
        {
          id: 'feed-freshness',
          label: 'Feed freshness',
          message: 'Feed is stale.',
          severity: 'warn',
        },
      ],
      status: 'fail',
      totals: {
        ...baseReadiness.totals,
        staleProducts: 2,
        urlMismatches: 3,
      },
    } satisfies AgentCommerceTrustReadinessSummary;

    render(
      <AgenticTrustCenterCard readiness={readinessWithBlockers} state="ready" />
    );

    expect(screen.getByText('Needs fixes')).toBeInTheDocument();
    expect(screen.getByText('Fix product URLs')).toBeInTheDocument();
    expect(screen.getByText('Refresh catalog feed')).toBeInTheDocument();
    const reviewLinks = screen.getAllByRole('link', { name: /review/i });
    expect(reviewLinks).toHaveLength(2);
    expect(reviewLinks[0]).toHaveAttribute('href', '/dashboard/seo');
  });

  it('renders action fixes from the slim summary affectedProductCount', () => {
    // Regression: the slim client payload carries `affectedProductCount`
    // instead of the heavy `affectedProductIds` array. The card must still
    // surface the fix without the array being serialized to the client.
    const readinessWithCounts: AgentCommerceTrustReadinessSummary = {
      ...baseReadiness,
      checks: [
        {
          affectedProductCount: 7,
          id: 'catalog-surface-parity',
          label: 'Catalog surface parity',
          message: 'Products missing from a feed.',
          severity: 'fail',
        },
      ],
      status: 'fail',
    };

    render(
      <AgenticTrustCenterCard readiness={readinessWithCounts} state="ready" />
    );

    expect(screen.getByText('Needs fixes')).toBeInTheDocument();
    expect(screen.getByText('Review catalog surfaces')).toBeInTheDocument();
  });

  it('returns null for unauthorized state', () => {
    render(<AgenticTrustCenterCard readiness={null} state="unauthorized" />);
    expect(screen.queryByText('Agent trust center')).not.toBeInTheDocument();
  });

  it('shows unavailable state when readiness is unavailable', () => {
    render(<AgenticTrustCenterCard readiness={null} state="error" />);

    expect(screen.getByText('Agent trust center')).toBeInTheDocument();
    expect(
      screen.getByText('Unable to load trust readiness right now.')
    ).toBeInTheDocument();
  });
});
