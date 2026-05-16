import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentCommerceTrustReadiness } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
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

const baseReadiness: AgentCommerceTrustReadiness = {
  checks: [
    {
      id: 'catalog-surface-parity',
      label: 'Catalog surface parity',
      message: 'Catalog is present.',
      severity: 'pass',
    },
  ],
  status: 'pass',
  surfaces: {
    agentCommerceManifest: 'https://example.com/agent-commerce.json',
    agentNativeCommerce:
      'https://example.com/.well-known/agent-native-commerce',
    agentTrust: 'https://example.com/agent-trust.json',
    currentProductFeed: 'https://example.com/feeds/agent-products.jsonl',
    googleMerchantXml: 'https://example.com/feeds/google-merchant.xml',
    openAiProductFeed: 'https://example.com/feeds/openai.jsonl',
    productApi: 'https://example.com/api/storefront/demo/products',
    policies: {
      privacy_policy_url: 'https://example.com/privacy',
      return_policy_url: 'https://example.com/returns',
      shipping_policy_url: 'https://example.com/shipping',
      terms_of_service_url: 'https://example.com/terms',
    },
    robots: 'https://example.com/robots.txt',
    sitemap: 'https://example.com/sitemap.xml',
    ucpProfile: 'https://example.com/.well-known/ucp',
  },
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
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders trust status for healthy readiness', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => baseReadiness,
    } as Response);

    render(<AgenticTrustCenterCard />);

    expect(
      screen.getByText('Checking agent trust health...')
    ).toBeInTheDocument();
    expect(await screen.findByText('Agent trust center')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(
      screen.getByText('No trust issues require action right now.')
    ).toBeInTheDocument();
  });

  it('renders top trust fixes with review links when readiness has blockers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () =>
        ({
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
        }) satisfies AgentCommerceTrustReadiness,
    } as Response);

    render(<AgenticTrustCenterCard />);

    expect(await screen.findByText('Needs fixes')).toBeInTheDocument();
    expect(screen.getByText('Fix product URLs')).toBeInTheDocument();
    expect(screen.getByText('Refresh catalog feed')).toBeInTheDocument();
    const reviewLinks = screen.getAllByRole('link', { name: /review/i });
    expect(reviewLinks).toHaveLength(2);
    expect(reviewLinks[0]).toHaveAttribute('href', '/dashboard/seo');
  });

  it('returns null for unauthorized responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    render(<AgenticTrustCenterCard />);

    await waitFor(() => {
      expect(
        screen.queryByText('Checking agent trust health...')
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Agent trust center')).not.toBeInTheDocument();
  });

  it('shows unavailable state when readiness fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('boom'));

    render(<AgenticTrustCenterCard />);

    expect(await screen.findByText('Agent trust center')).toBeInTheDocument();
    expect(
      screen.getByText('Unable to load trust readiness right now.')
    ).toBeInTheDocument();
  });
});
