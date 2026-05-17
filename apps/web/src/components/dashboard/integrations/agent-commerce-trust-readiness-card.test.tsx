import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AgentCommerceTrustReadiness } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { AgentCommerceTrustReadinessCard } from './agent-commerce-trust-readiness-card';

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

const readiness: AgentCommerceTrustReadiness = {
  checks: [
    {
      id: 'catalog-surface-parity',
      label: 'Catalog surface parity',
      severity: 'pass',
      message: '2 products are present across feed sources.',
      next_step: 'Keep feed parity checks in your weekly operations review.',
    },
    {
      affectedProductIds: ['product-1', 'product-2'],
      id: 'canonical-url-parity',
      label: 'Canonical URL parity',
      severity: 'fail',
      message: '2 products have mismatched canonical URLs.',
      next_step: 'Fix URL mismatches in product setup and rerun feed checks.',
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
  surfaces: {
    agentCommerceManifest: 'https://example.com/agent-commerce.json',
    agentNativeCommerce:
      'https://example.com/.well-known/agent-native-commerce',
    agentTrust: 'https://example.com/agent-trust.json',
    currentProductFeed: 'https://example.com/feeds/agent-products.jsonl',
    googleMerchantXml: 'https://example.com/feeds/google-merchant.xml',
    openAiProductFeed: 'https://example.com/feeds/openai.jsonl',
    productApi: 'https://example.com/api/storefront/demo/products',
    llms: 'https://example.com/llms.txt',
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
};

describe('AgentCommerceTrustReadinessCard', () => {
  it('renders agent trust checks from server-provided readiness data', () => {
    render(<AgentCommerceTrustReadinessCard readiness={readiness} />);

    expect(
      screen.getByText(/agent trust health has blockers/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Catalog surface parity')).toBeInTheDocument();
    expect(screen.getByText('Canonical URL parity')).toBeInTheDocument();
    expect(screen.getByText('Policy coverage')).toBeInTheDocument();
    expect(screen.getByText('Structured data readiness')).toBeInTheDocument();
    expect(screen.getByText('Feed freshness')).toBeInTheDocument();
    expect(screen.getByText('Crawler visibility')).toBeInTheDocument();
    expect(screen.getByText('Machine contracts')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open Agent proof' })
    ).toHaveAttribute(
      'href',
      'https://example.com/.well-known/agent-native-commerce'
    );
    expect(
      screen.getByRole('link', { name: 'Open Commerce manifest' })
    ).toHaveAttribute('href', 'https://example.com/agent-commerce.json');
    expect(
      screen.getByRole('link', { name: 'Open Trust signals' })
    ).toHaveAttribute('href', 'https://example.com/agent-trust.json');
    expect(
      screen.getByRole('link', { name: 'Open UCP profile' })
    ).toHaveAttribute('href', 'https://example.com/.well-known/ucp');
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
    expect(
      screen.getByText(
        'Next: Fix URL mismatches in product setup and rerun feed checks.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Next: Keep feed parity checks in your weekly operations review.'
      )
    ).not.toBeInTheDocument();
  });

  it('shows an error state when readiness data is unavailable', () => {
    render(
      <AgentCommerceTrustReadinessCard
        error="Unable to load agent trust health"
        readiness={null}
      />
    );

    expect(
      screen.getByText('Unable to load agent trust health')
    ).toBeInTheDocument();
  });
});
