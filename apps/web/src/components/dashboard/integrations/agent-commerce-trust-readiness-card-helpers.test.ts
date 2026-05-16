import { describe, expect, it } from 'vitest';
import type { AgentCommerceTrustReadiness } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { agentCommerceTrustReadinessCardHelpers } from './agent-commerce-trust-readiness-card-helpers';

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
    productsWithVerifiedImages: 3,
    sharedProducts: 4,
    staleProducts: 0,
    urlMismatches: 0,
  },
};

describe('agentCommerceTrustReadinessCardHelpers', () => {
  it('builds public machine contract links for the merchant trust card', () => {
    const links =
      agentCommerceTrustReadinessCardHelpers.buildMachineContractLinks(
        baseReadiness
      );

    expect(
      links.map(({ href, id, label }) => ({
        href,
        id,
        label,
      }))
    ).toEqual([
      {
        href: 'https://example.com/.well-known/agent-native-commerce',
        id: 'agent-native-commerce',
        label: 'Agent proof',
      },
      {
        href: 'https://example.com/agent-commerce.json',
        id: 'agent-commerce-manifest',
        label: 'Commerce manifest',
      },
      {
        href: 'https://example.com/agent-trust.json',
        id: 'agent-trust',
        label: 'Trust signals',
      },
      {
        href: 'https://example.com/.well-known/ucp',
        id: 'ucp-profile',
        label: 'UCP profile',
      },
    ]);
  });

  it('skips unavailable machine contract links', () => {
    const links =
      agentCommerceTrustReadinessCardHelpers.buildMachineContractLinks({
        ...baseReadiness,
        surfaces: {
          ...baseReadiness.surfaces,
          ucpProfile: '',
        },
      });

    expect(links.map((link) => link.id)).toEqual([
      'agent-native-commerce',
      'agent-commerce-manifest',
      'agent-trust',
    ]);
  });

  it('builds prioritized dashboard actions for failing and warning checks', () => {
    const actionItems =
      agentCommerceTrustReadinessCardHelpers.buildTrustActionItems({
        ...baseReadiness,
        checks: [
          {
            id: 'verified-image-coverage',
            label: 'Verified image coverage',
            message: '3 of 4 products have verified images.',
            severity: 'warn',
          },
          {
            affectedProductIds: ['product-1', 'product-2'],
            id: 'canonical-url-parity',
            label: 'Canonical URL parity',
            message: '2 products have mismatched canonical URLs.',
            severity: 'fail',
          },
          {
            id: 'policy-coverage',
            label: 'Policy coverage',
            message: 'Policies are complete.',
            severity: 'pass',
          },
        ],
        status: 'fail',
        totals: {
          ...baseReadiness.totals,
          productsWithVerifiedImages: 3,
          urlMismatches: 2,
        },
      });

    expect(actionItems).toEqual([
      {
        count: 2,
        href: '/dashboard/seo',
        id: 'canonical-url-parity',
        label: 'Fix product URLs',
        message:
          'Align canonical product URLs before agents recommend products.',
        severity: 'fail',
      },
      {
        count: 1,
        href: '/dashboard/products',
        id: 'verified-image-coverage',
        label: 'Verify product images',
        message:
          'Add valid product images for agent and Merchant Center trust.',
        severity: 'warn',
      },
    ]);
  });

  it('returns no actions when every trust check passes', () => {
    expect(
      agentCommerceTrustReadinessCardHelpers.buildTrustActionItems(
        baseReadiness
      )
    ).toEqual([]);
  });

  it('derives counts from readiness totals and preserves same-severity order', () => {
    const actionItems =
      agentCommerceTrustReadinessCardHelpers.buildTrustActionItems({
        ...baseReadiness,
        checks: [
          {
            id: 'price-parity',
            label: 'Price parity',
            message: '3 prices differ.',
            severity: 'fail',
          },
          {
            id: 'feed-freshness',
            label: 'Feed freshness',
            message: '2 products are stale.',
            severity: 'warn',
          },
          {
            id: 'policy-coverage',
            label: 'Policy coverage',
            message: 'Policies are missing.',
            severity: 'fail',
          },
          {
            id: 'support-contact',
            label: 'Support contact',
            message: 'Support contact is missing.',
            severity: 'warn',
          },
        ],
        status: 'fail',
        totals: {
          ...baseReadiness.totals,
          priceMismatches: 3,
          staleProducts: 2,
        },
      });

    expect(
      actionItems.map(({ count, href, id, label, severity }) => ({
        count,
        href,
        id,
        label,
        severity,
      }))
    ).toEqual([
      {
        count: 3,
        href: '/dashboard/products',
        id: 'price-parity',
        label: 'Review product prices',
        severity: 'fail',
      },
      {
        count: null,
        href: '/dashboard/settings/trust',
        id: 'policy-coverage',
        label: 'Update policies',
        severity: 'fail',
      },
      {
        count: 2,
        href: '/dashboard/products',
        id: 'feed-freshness',
        label: 'Refresh catalog feed',
        severity: 'warn',
      },
      {
        count: null,
        href: '/dashboard/settings/trust',
        id: 'support-contact',
        label: 'Update support contact',
        severity: 'warn',
      },
    ]);
  });

  it('returns no actions when the readiness check list is empty', () => {
    expect(
      agentCommerceTrustReadinessCardHelpers.buildTrustActionItems({
        ...baseReadiness,
        checks: [],
      })
    ).toEqual([]);
  });

  it('skips unrecognized check ids from future API versions', () => {
    const actionItems =
      agentCommerceTrustReadinessCardHelpers.buildTrustActionItems({
        ...baseReadiness,
        checks: [
          {
            id: 'future-check' as never,
            label: 'Future check',
            message: 'Future API drift.',
            severity: 'fail',
          },
          {
            id: 'policy-coverage',
            label: 'Policy coverage',
            message: 'Policies are missing.',
            severity: 'fail',
          },
        ],
        status: 'fail',
      });

    expect(actionItems.map((item) => item.id)).toEqual(['policy-coverage']);
  });

  it('keeps input order when every action has the same severity', () => {
    const actionItems =
      agentCommerceTrustReadinessCardHelpers.buildTrustActionItems({
        ...baseReadiness,
        checks: [
          {
            id: 'support-contact',
            label: 'Support contact',
            message: 'Support contact is missing.',
            severity: 'warn',
          },
          {
            id: 'feed-freshness',
            label: 'Feed freshness',
            message: '2 products are stale.',
            severity: 'warn',
          },
        ],
        status: 'warn',
        totals: {
          ...baseReadiness.totals,
          staleProducts: 2,
        },
      });

    expect(actionItems.map((item) => item.id)).toEqual([
      'support-contact',
      'feed-freshness',
    ]);
  });
});
