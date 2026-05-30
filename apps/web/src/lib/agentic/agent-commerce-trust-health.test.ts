import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  checkAgentCommerceTrustHealth,
  validateAgentCommerceTrustHealth,
} from './agent-commerce-trust-health';

function createHealthyTrustDocument() {
  return {
    store: {
      canonical_origin: 'https://ogabassey.com',
      name: 'Ogabassey',
      slug: 'ogabassey',
    },
    trust: {
      checks: [
        {
          id: 'canonical-url-parity',
          message: 'Canonical product URLs match across public feed surfaces.',
          severity: 'pass',
        },
      ],
      status: 'pass',
    },
  };
}

function createTrustResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('validateAgentCommerceTrustHealth', () => {
  it('passes a healthy public trust-readiness contract', () => {
    expect(
      validateAgentCommerceTrustHealth({
        expectedOrigin: 'https://ogabassey.com',
        expectedSlug: 'ogabassey',
        trustDocument: createHealthyTrustDocument(),
        url: 'https://ogabassey.com/agent-trust.json',
      })
    ).toEqual({
      issue_count: 0,
      issues: [],
      status: 'ok',
      url: 'https://ogabassey.com/agent-trust.json',
    });
  });

  it('maps warning and failed readiness checks to scheduled-health issues', () => {
    const result = validateAgentCommerceTrustHealth({
      expectedOrigin: 'https://ogabassey.com',
      expectedSlug: 'ogabassey',
      trustDocument: {
        ...createHealthyTrustDocument(),
        trust: {
          checks: [
            {
              affectedProductCount: 2,
              id: 'feed-freshness',
              message: 'Two catalog products are stale.',
              severity: 'warn',
            },
            {
              affectedProductIds: ['product-1', 'product-2', 'product-3'],
              id: 'price-parity',
              message: 'Prices differ across public feed surfaces.',
              severity: 'fail',
            },
          ],
          status: 'fail',
        },
      },
      url: 'https://ogabassey.com/agent-trust.json',
    });

    expect(result).toEqual({
      issue_count: 2,
      issues: [
        {
          check_id: 'feed-freshness',
          code: 'trust_check_warning',
          count: 2,
          message: 'Two catalog products are stale.',
          severity: 'monitor',
        },
        {
          check_id: 'price-parity',
          code: 'trust_check_failed',
          count: 3,
          message: 'Prices differ across public feed surfaces.',
          severity: 'attention',
        },
      ],
      status: 'attention',
      url: 'https://ogabassey.com/agent-trust.json',
    });
  });

  it('treats an inconsistent aggregate trust status as contract drift', () => {
    const result = validateAgentCommerceTrustHealth({
      expectedOrigin: 'https://ogabassey.com',
      expectedSlug: 'ogabassey',
      trustDocument: {
        ...createHealthyTrustDocument(),
        trust: {
          checks: [
            {
              id: 'policy-coverage',
              message: 'Shipping policy is missing.',
              severity: 'fail',
            },
          ],
          status: 'pass',
        },
      },
      url: 'https://ogabassey.com/agent-trust.json',
    });

    expect(result.status).toBe('attention');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'trust_contract_drift' }),
      ])
    );
  });

  it('rejects a trust document scoped to a different storefront', () => {
    const result = validateAgentCommerceTrustHealth({
      expectedOrigin: 'https://ogabassey.com',
      expectedSlug: 'ogabassey',
      trustDocument: {
        ...createHealthyTrustDocument(),
        store: {
          canonical_origin: 'https://another-store.example',
          slug: 'another-store',
        },
      },
      url: 'https://ogabassey.com/agent-trust.json',
    });

    expect(result.status).toBe('attention');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'trust_contract_drift',
          message: 'Trust readiness store slug is not scoped.',
        }),
        expect.objectContaining({
          code: 'trust_contract_drift',
          message:
            'Trust readiness canonical origin does not match its storefront URL.',
        }),
      ])
    );
  });

  it('rejects a trust contract without readiness checks', () => {
    const result = validateAgentCommerceTrustHealth({
      expectedOrigin: 'https://ogabassey.com',
      expectedSlug: 'ogabassey',
      trustDocument: {
        ...createHealthyTrustDocument(),
        trust: {
          checks: [],
          status: 'pass',
        },
      },
      url: 'https://ogabassey.com/agent-trust.json',
    });

    expect(result).toMatchObject({
      issues: [expect.objectContaining({ code: 'trust_contract_drift' })],
      status: 'attention',
    });
  });
});

describe('checkAgentCommerceTrustHealth', () => {
  it('fetches public trust readiness without cache and validates it', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createTrustResponse(createHealthyTrustDocument()));

    const result = await checkAgentCommerceTrustHealth(
      {
        custom_domain: 'ogabassey.com',
        slug: 'ogabassey',
      },
      fetcher
    );

    expect(result.status).toBe('ok');
    expect(fetcher).toHaveBeenCalledWith(
      'https://ogabassey.com/agent-trust.json',
      {
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }
    );
  });

  it('returns attention when the public trust endpoint is unavailable', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createTrustResponse({ error: 'missing' }, 500));

    await expect(
      checkAgentCommerceTrustHealth(
        {
          custom_domain: 'ogabassey.com',
          slug: 'ogabassey',
        },
        fetcher
      )
    ).resolves.toMatchObject({
      issue_count: 1,
      issues: [
        {
          code: 'trust_unavailable',
          count: 1,
          message: 'Trust readiness returned HTTP 500.',
          severity: 'attention',
        },
      ],
      status: 'attention',
    });
  });

  it('returns attention when the public trust response is invalid JSON', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not json', {
        headers: { 'content-type': 'application/json' },
        status: 200,
      })
    );

    await expect(
      checkAgentCommerceTrustHealth(
        {
          custom_domain: 'ogabassey.com',
          slug: 'ogabassey',
        },
        fetcher
      )
    ).resolves.toMatchObject({
      issues: [expect.objectContaining({ code: 'trust_invalid_json' })],
      status: 'attention',
    });
  });

  it('returns attention when the public trust fetch rejects', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('Network error'));

    await expect(
      checkAgentCommerceTrustHealth(
        {
          custom_domain: 'ogabassey.com',
          slug: 'ogabassey',
        },
        fetcher
      )
    ).resolves.toMatchObject({
      issues: [expect.objectContaining({ code: 'trust_unavailable' })],
      status: 'attention',
    });
  });
});
