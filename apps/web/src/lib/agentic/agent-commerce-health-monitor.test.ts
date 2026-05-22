import { describe, expect, it, vi } from 'vitest';
import {
  buildAgentCommerceManifestHealthActions,
  fetchPrimaryAgenticMerchantDomains,
  getAgentCommerceManifestStatusReason,
  getAgenticCommerceHealthStatus,
  summarizeAgenticCommerceHealthActions,
} from './agent-commerce-health-monitor';

describe('buildAgentCommerceManifestHealthActions', () => {
  it('returns no action when manifest health is ok', () => {
    expect(
      buildAgentCommerceManifestHealthActions({
        issue_count: 0,
        issues: [],
        status: 'ok',
        url: 'https://ogabassey.com/agent-commerce.json',
      })
    ).toEqual([]);
  });

  it('maps manifest drift into an attention action', () => {
    expect(
      buildAgentCommerceManifestHealthActions({
        issue_count: 2,
        issues: [{ code: 'manifest_contract_drift', message: 'drift' }],
        status: 'attention',
        url: 'https://ogabassey.com/agent-commerce.json',
      })
    ).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_MANIFEST_DRIFT',
        count: 2,
        severity: 'attention',
      }),
    ]);
  });

  it('uses an unavailable status reason when the manifest cannot be fetched', () => {
    const manifest = {
      issue_count: 1,
      issues: [{ code: 'manifest_unavailable' as const, message: 'missing' }],
      status: 'attention' as const,
      url: 'https://ogabassey.com/agent-commerce.json',
    };

    expect(buildAgentCommerceManifestHealthActions(manifest)[0].code).toBe(
      'AGENT_COMMERCE_MANIFEST_UNAVAILABLE'
    );
    expect(
      getAgentCommerceManifestStatusReason(manifest, 'agentic_action_health_ok')
    ).toBe('agent_commerce_manifest_unavailable');
  });
});

describe('agentic commerce health summaries', () => {
  const actions = [
    {
      code: 'AGENTIC_ACTIONS_HEALTHY',
      count: 0,
      message: 'No issues',
      severity: 'ok' as const,
    },
    {
      code: 'AGENT_COMMERCE_MANIFEST_DRIFT',
      count: 2,
      message: 'Drift',
      severity: 'attention' as const,
    },
  ];

  it('summarizes non-zero actions', () => {
    expect(summarizeAgenticCommerceHealthActions(actions)).toEqual([
      {
        code: 'AGENT_COMMERCE_MANIFEST_DRIFT',
        count: 2,
        severity: 'attention',
      },
    ]);
  });

  it('returns ok when no health actions need attention', () => {
    expect(getAgenticCommerceHealthStatus([])).toBe('ok');
  });

  it('returns attention when any attention action has a count', () => {
    expect(getAgenticCommerceHealthStatus(actions)).toBe('attention');
  });

  it('returns monitor when only monitor actions have counts', () => {
    expect(
      getAgenticCommerceHealthStatus([
        { ...actions[1], count: 1, severity: 'monitor' },
      ])
    ).toBe('monitor');
  });
});

describe('fetchPrimaryAgenticMerchantDomains', () => {
  it('returns an empty map without querying when no merchants are supplied', async () => {
    const supabase = { from: vi.fn() };

    await expect(
      fetchPrimaryAgenticMerchantDomains(supabase as never, [])
    ).resolves.toEqual(new Map());
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('loads active primary domains for monitored merchants', async () => {
    const domainQuery = {
      eq: vi.fn(),
      in: vi.fn(),
      select: vi.fn(),
    };
    domainQuery.select.mockReturnValue(domainQuery);
    domainQuery.in.mockReturnValue(domainQuery);
    domainQuery.eq
      .mockImplementationOnce(() => domainQuery)
      .mockResolvedValueOnce({
        data: [{ domain: 'ogabassey.com', merchant_id: 'merchant-1' }],
        error: null,
      });
    const supabase = {
      from: vi.fn(() => domainQuery),
    };

    await expect(
      fetchPrimaryAgenticMerchantDomains(supabase as never, ['merchant-1'])
    ).resolves.toEqual(new Map([['merchant-1', 'ogabassey.com']]));
    expect(supabase.from).toHaveBeenCalledWith('domains');
    expect(domainQuery.select).toHaveBeenCalledWith('merchant_id, domain');
    expect(domainQuery.in).toHaveBeenCalledWith('merchant_id', ['merchant-1']);
    expect(domainQuery.eq).toHaveBeenCalledWith('is_primary', true);
    expect(domainQuery.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('throws when the domains query fails', async () => {
    const error = new Error('boom');
    const domainQuery = {
      eq: vi.fn(),
      in: vi.fn(),
      select: vi.fn(),
    };
    domainQuery.select.mockReturnValue(domainQuery);
    domainQuery.in.mockReturnValue(domainQuery);
    domainQuery.eq
      .mockImplementationOnce(() => domainQuery)
      .mockResolvedValueOnce({
        data: null,
        error,
      });
    const supabase = { from: vi.fn(() => domainQuery) };

    await expect(
      fetchPrimaryAgenticMerchantDomains(supabase as never, ['merchant-1'])
    ).rejects.toBe(error);
  });

  it('filters rows missing merchant ids or domains', async () => {
    const domainQuery = {
      eq: vi.fn(),
      in: vi.fn(),
      select: vi.fn(),
    };
    domainQuery.select.mockReturnValue(domainQuery);
    domainQuery.in.mockReturnValue(domainQuery);
    domainQuery.eq
      .mockImplementationOnce(() => domainQuery)
      .mockResolvedValueOnce({
        data: [
          { domain: 'missing-id.example', merchant_id: null },
          { domain: null, merchant_id: 'merchant-1' },
          { domain: 'valid.example', merchant_id: 'merchant-2' },
        ],
        error: null,
      });
    const supabase = { from: vi.fn(() => domainQuery) };

    await expect(
      fetchPrimaryAgenticMerchantDomains(supabase as never, ['merchant-2'])
    ).resolves.toEqual(new Map([['merchant-2', 'valid.example']]));
  });
});
