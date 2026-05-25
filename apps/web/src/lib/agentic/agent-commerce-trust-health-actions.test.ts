import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildAgentCommerceTrustHealthActions,
  getAgentCommerceTrustStatusReason,
} from './agent-commerce-trust-health';

const TRUST_URL = 'https://ogabassey.com/agent-trust.json';

describe('trust readiness health actions', () => {
  it('returns no action for healthy trust readiness', () => {
    const health = {
      issue_count: 0,
      issues: [],
      status: 'ok' as const,
      url: TRUST_URL,
    };

    const actions = buildAgentCommerceTrustHealthActions(health);
    const reason = getAgentCommerceTrustStatusReason(
      health,
      'agentic_action_health_ok'
    );

    expect(actions).toEqual([]);
    expect(reason).toBe('agentic_action_health_ok');
  });

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
      url: TRUST_URL,
    };

    const actions = buildAgentCommerceTrustHealthActions(health);
    const reason = getAgentCommerceTrustStatusReason(
      health,
      'agentic_action_health_ok'
    );

    expect(actions).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_TRUST_FAILED',
        count: 2,
        severity: 'attention',
      }),
    ]);
    expect(reason).toBe('agent_commerce_trust_failed');
  });

  it('turns unavailable readiness into an unavailable attention action', () => {
    const health = {
      issue_count: 1,
      issues: [
        {
          code: 'trust_unavailable' as const,
          count: 1,
          message: 'Trust readiness could not be fetched.',
          severity: 'attention' as const,
        },
      ],
      status: 'attention' as const,
      url: TRUST_URL,
    };

    const actions = buildAgentCommerceTrustHealthActions(health);
    const reason = getAgentCommerceTrustStatusReason(
      health,
      'agentic_action_health_ok'
    );

    expect(actions).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_TRUST_UNAVAILABLE',
        severity: 'attention',
      }),
    ]);
    expect(reason).toBe('agent_commerce_trust_unavailable');
  });

  it('turns contract drift into a contract-drift attention action', () => {
    const health = {
      issue_count: 1,
      issues: [
        {
          code: 'trust_contract_drift' as const,
          count: 1,
          message: 'Trust readiness contract has drifted.',
          severity: 'attention' as const,
        },
      ],
      status: 'attention' as const,
      url: TRUST_URL,
    };

    const actions = buildAgentCommerceTrustHealthActions(health);
    const reason = getAgentCommerceTrustStatusReason(
      health,
      'agentic_action_health_ok'
    );

    expect(actions).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_TRUST_CONTRACT_DRIFT',
        severity: 'attention',
      }),
    ]);
    expect(reason).toBe('agent_commerce_trust_contract_drift');
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
      url: TRUST_URL,
    };

    const actions = buildAgentCommerceTrustHealthActions(health);
    const reason = getAgentCommerceTrustStatusReason(
      health,
      'agent_commerce_feed_generation_failed'
    );

    expect(actions).toEqual([
      expect.objectContaining({
        code: 'AGENT_COMMERCE_TRUST_WARNING',
        count: 1,
        severity: 'monitor',
      }),
    ]);
    expect(reason).toBe('agent_commerce_feed_generation_failed');
  });
});
