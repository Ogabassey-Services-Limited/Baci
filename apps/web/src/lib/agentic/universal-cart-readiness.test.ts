import { describe, expect, it, vi } from 'vitest';
import {
  buildAgentCommerceUniversalCartHealthActions,
  checkAgentCommerceUniversalCartReadiness,
  getAgentCommerceUniversalCartStatusReason,
} from './universal-cart-readiness';

const readyProfile = {
  ucp: {
    capabilities: {
      'dev.ucp.shopping.cart': [{}],
      'dev.ucp.shopping.catalog.lookup': [{}],
      'dev.ucp.shopping.catalog.search': [{}],
      'dev.ucp.shopping.checkout': [{}],
      'dev.ucp.shopping.order': [{}],
    },
    payment_handlers: {
      'com.paystack.bank_transfer': [{}],
    },
  },
};

describe('checkAgentCommerceUniversalCartReadiness', () => {
  it('passes when cart, catalog, checkout, order, and payment handlers exist', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(readyProfile), { status: 200 })
      );

    const result = await checkAgentCommerceUniversalCartReadiness(
      { custom_domain: 'ogabassey.com', slug: 'ogabassey' },
      fetcher,
      () => new Date('2026-05-26T12:00:00.000Z')
    );

    expect(result).toMatchObject({
      lastCheckedAt: '2026-05-26T12:00:00.000Z',
      status: 'pass',
      url: 'https://ogabassey.com/.well-known/ucp',
    });
    expect(result.checks).toHaveLength(9);
    expect(result.checks.every((check) => check.status === 'pass')).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      'https://ogabassey.com/.well-known/ucp',
      expect.objectContaining({
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('fails when Universal Cart capabilities are incomplete', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ucp: {
            capabilities: {
              'dev.ucp.shopping.checkout': [{}],
            },
            payment_handlers: {},
          },
        }),
        { status: 200 }
      )
    );

    const result = await checkAgentCommerceUniversalCartReadiness(
      { slug: 'ogabassey' },
      fetcher
    );

    expect(result.status).toBe('fail');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ucp_cart_capability',
          status: 'fail',
        }),
        expect.objectContaining({
          id: 'payment_handler_configured',
          status: 'fail',
        }),
      ])
    );
  });

  it('fails closed on Google Pay and AP2 misadvertising', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ucp: {
            capabilities: {
              ...readyProfile.ucp.capabilities,
              'dev.ucp.shopping.ap2_mandate': [{}],
            },
            payment_handlers: {
              'com.google.pay': [{ config: { gateway: 'manual' } }],
            },
          },
        }),
        { status: 200 }
      )
    );

    const result = await checkAgentCommerceUniversalCartReadiness(
      { slug: 'ogabassey' },
      fetcher
    );

    expect(result.status).toBe('fail');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'google_pay_not_misadvertised',
          status: 'fail',
        }),
        expect.objectContaining({
          id: 'ap2_not_misadvertised',
          status: 'fail',
        }),
      ])
    );
  });

  it('maps non-pass readiness into monitor actions and status reasons', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('missing', { status: 404 }));

    const result = await checkAgentCommerceUniversalCartReadiness(
      { slug: 'ogabassey' },
      fetcher
    );

    expect(buildAgentCommerceUniversalCartHealthActions(result)).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_UNIVERSAL_CART_NOT_READY',
        severity: 'attention',
      }),
    ]);
    expect(
      getAgentCommerceUniversalCartStatusReason(
        result,
        'agentic_action_health_ok'
      )
    ).toBe('agent_commerce_universal_cart_not_ready');
  });

  it('fails closed when the UCP profile fetch rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await checkAgentCommerceUniversalCartReadiness(
      { slug: 'ogabassey' },
      fetcher
    );

    expect(result.status).toBe('fail');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ucp_profile_reachable',
          message: 'UCP profile could not be fetched.',
          status: 'fail',
        }),
      ])
    );
    expect(
      buildAgentCommerceUniversalCartHealthActions(result)[0]
    ).toMatchObject({
      code: 'AGENT_COMMERCE_UNIVERSAL_CART_NOT_READY',
      severity: 'attention',
    });
  });

  it('fails closed when the UCP profile is invalid JSON', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('invalid json', { status: 200 }));

    const result = await checkAgentCommerceUniversalCartReadiness(
      { slug: 'ogabassey' },
      fetcher
    );

    expect(result.status).toBe('fail');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ucp_profile_reachable',
          status: 'fail',
        }),
      ])
    );
    expect(
      getAgentCommerceUniversalCartStatusReason(
        result,
        'agentic_action_health_ok'
      )
    ).toBe('agent_commerce_universal_cart_not_ready');
  });
});
