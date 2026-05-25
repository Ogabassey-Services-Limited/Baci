import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildAgentCommerceTrustHealthActions,
  getAgentCommerceTrustStatusReason,
} from './agent-commerce-trust-health';

describe('trust readiness health actions', () => {
  it('turns failed readiness into a commerce attention action and status reason', () => {
    const health = {
      issue_count: 1,
      issues: [
        {
          check_id: 'price-parity',
          code: 'trust_check_failed' as const,
          count: 2,
          message: 'Prices differ.',
          severity: 'attention' as const,
        },
      ],
      status: 'attention' as const,
      url: 'https://ogabassey.com/agent-trust.json',
    };

    expect(buildAgentCommerceTrustHealthActions(health)).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_TRUST_FAILED',
        count: 2,
        severity: 'attention',
      }),
    ]);
    expect(
      getAgentCommerceTrustStatusReason(health, 'agentic_action_health_ok')
    ).toBe('agent_commerce_trust_failed');
  });

  it('turns readiness warnings into monitor-only actions', () => {
    const health = {
      issue_count: 1,
      issues: [
        {
          check_id: 'feed-freshness',
          code: 'trust_check_warning' as const,
          count: 1,
          message: 'A catalog product is stale.',
          severity: 'monitor' as const,
        },
      ],
      status: 'monitor' as const,
      url: 'https://ogabassey.com/agent-trust.json',
    };

    expect(buildAgentCommerceTrustHealthActions(health)).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_TRUST_WARNING',
        count: 1,
        severity: 'monitor',
      }),
    ]);
    expect(
      getAgentCommerceTrustStatusReason(
        health,
        'agent_commerce_feed_generation_failed'
      )
    ).toBe('agent_commerce_feed_generation_failed');
  });
});
