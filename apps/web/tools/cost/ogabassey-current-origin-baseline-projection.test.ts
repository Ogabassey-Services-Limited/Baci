import { describe, expect, it } from 'vitest';
import { evaluateOgabasseyOriginBusinessCase } from './ogabassey-current-origin-baseline';
import { current } from './ogabassey-current-origin-baseline.test-fixtures';

describe('evaluateOgabasseyOriginBusinessCase cost projection gate', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');

  it('fails closed without a reducible-static projection', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, originCostProjection: undefined },
        { now }
      )
    ).toEqual({
      verdict: 'NOT_PROVEN',
      reasonCodes: ['origin_cost_projection_invalid'],
    });
  });

  it('stops when dynamic origin cost is dominant', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          currentVercelAttributionUsd: '21.00',
          originCostProjection: {
            irreducibleDynamicOriginCostUsd: '11.00',
            reducibleStaticOriginCostUsd: '10.00',
          },
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['dynamic_origin_cost_dominant'],
    });
  });

  it('fails closed when the projection does not reconcile to attributed origin cost', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          originCostProjection: {
            irreducibleDynamicOriginCostUsd: '2.00',
            reducibleStaticOriginCostUsd: '9.99',
          },
        },
        { now }
      )
    ).toEqual({
      verdict: 'NOT_PROVEN',
      reasonCodes: ['origin_cost_projection_mismatch'],
    });
  });

  it('includes current account events when enforcing forced-sampling headroom', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          workersLogsContract: {
            ...current.workersLogsContract,
            currentUtcDayAllAccountEvents: 4_900_000_000n,
          },
          projectedAccountLogEventsPerDay: 50_000_000n,
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['workers_logs_forced_sampling_headroom_insufficient'],
    });
  });

  it('scales Paid monthly projection and binds overage cost before savings', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          currentVercelAttributionUsd: '10.00',
          projectedEdgeCostUsd: '1.00',
          originCostProjection: {
            irreducibleDynamicOriginCostUsd: '2.00',
            reducibleStaticOriginCostUsd: '8.00',
          },
          workersLogsContract: {
            ...current.workersLogsContract,
            plan: 'paid' as const,
            allowanceEvents: 20_000_000n,
            allowancePeriod: 'billing_month' as const,
            allowancePeriodStartsAt: '2026-08-01T00:00:00.000Z',
            allowancePeriodEndsAt: '2026-09-01T00:00:00.000Z',
            currentAllowancePeriodAllAccountEvents: 19_000_000n,
            overageAllowed: true,
            overageUsdPerMillion: '0.60',
          },
          projectedAccountLogEventsPerDay: 1_000_000n,
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['savings_not_positive'],
    });
  });
});
