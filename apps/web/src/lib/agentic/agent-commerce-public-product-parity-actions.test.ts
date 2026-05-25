import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  type AgentCommercePublicProductParityResult,
  buildAgentCommercePublicProductParityActions,
  getAgentCommercePublicProductParityStatusReason,
} from './agent-commerce-public-product-parity-health';

const BASE_URL = 'https://ogabassey.com';
const API_URL = `${BASE_URL}/api/storefront/ogabassey/products?limit=10`;
const CURRENT_FEED_URL = `${BASE_URL}/feeds/agent-products.jsonl`;
const GOOGLE_FEED_URL = `${BASE_URL}/feeds/google-merchant.xml`;
const PDP_URL = `${BASE_URL}/phones/test-phone`;

describe('public product parity actions', () => {
  it('returns no actions and preserves the existing reason when parity is ok', () => {
    const result: AgentCommercePublicProductParityResult = {
      issue_count: 0,
      issues: [],
      sample_product_id: 'product-1',
      status: 'ok',
      surfaces: {
        agent_products: CURRENT_FEED_URL,
        google_merchant_xml: GOOGLE_FEED_URL,
        product_api: API_URL,
        product_page: PDP_URL,
      },
    };

    expect(buildAgentCommercePublicProductParityActions(result)).toEqual([]);
    expect(
      getAgentCommercePublicProductParityStatusReason(
        result,
        'agentic_action_health_ok'
      )
    ).toBe('agentic_action_health_ok');
  });

  it('maps mismatch attention into a parity action and reason', () => {
    const result: AgentCommercePublicProductParityResult = {
      issue_count: 1,
      issues: [
        {
          code: 'parity_surface_mismatch',
          count: 2,
          fields: ['image', 'price'],
          message: 'Public product fields do not match.',
          severity: 'attention',
        },
      ],
      sample_product_id: 'product-1',
      status: 'attention',
      surfaces: {
        agent_products: CURRENT_FEED_URL,
        google_merchant_xml: GOOGLE_FEED_URL,
        product_api: API_URL,
        product_page: PDP_URL,
      },
    };

    const actions = buildAgentCommercePublicProductParityActions(result);
    const reason = getAgentCommercePublicProductParityStatusReason(
      result,
      'agentic_action_health_ok'
    );

    expect(actions).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_PUBLIC_PRODUCT_PARITY_FAILED',
        count: 2,
        severity: 'attention',
      }),
    ]);
    expect(reason).toBe('agent_commerce_public_product_parity_failed');
  });

  it('preserves an existing attention reason for monitor-only sampling coverage', () => {
    const result: AgentCommercePublicProductParityResult = {
      issue_count: 1,
      issues: [
        {
          code: 'parity_sample_unavailable',
          count: 1,
          message: 'No comparable product sample is available.',
          severity: 'monitor',
        },
      ],
      sample_product_id: null,
      status: 'monitor',
      surfaces: {
        agent_products: CURRENT_FEED_URL,
        google_merchant_xml: GOOGLE_FEED_URL,
        product_api: API_URL,
      },
    };

    expect(
      getAgentCommercePublicProductParityStatusReason(
        result,
        'agent_commerce_trust_failed'
      )
    ).toBe('agent_commerce_trust_failed');
  });
});
