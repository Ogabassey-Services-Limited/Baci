import { describe, expect, it } from 'vitest';
import { evaluateOgabasseyOriginBusinessCase } from './ogabassey-current-origin-baseline';
import {
  current,
  currentWithWorkersLogsContract,
} from './ogabassey-current-origin-baseline.test-fixtures';

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

  it('includes irreducible dynamic origin cost before accepting savings', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          currentVercelAttributionUsd: '100.00',
          projectedEdgeCostUsd: '70.00',
          originCostProjection: {
            irreducibleDynamicOriginCostUsd: '40.00',
            reducibleStaticOriginCostUsd: '60.00',
          },
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['savings_not_positive'],
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

  it('includes current account events when enforcing forced-sampling headroom', async () => {
    const contract = await currentWithWorkersLogsContract({
      currentUtcDayAllAccountEvents: 4_900_000_000n,
    });
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          workersLogsContract: contract,
          expectedDailyWorkerInvocations: 25_000_000n,
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['workers_logs_forced_sampling_headroom_insufficient'],
    });
  });

  it('scales Paid monthly projection and binds overage cost before savings', async () => {
    const contract = await currentWithWorkersLogsContract({
      plan: 'paid' as const,
      allowanceEvents: 20_000_000n,
      allowancePeriod: 'billing_month' as const,
      allowancePeriodStartsAt: '2026-08-01T00:00:00.000Z',
      allowancePeriodEndsAt: '2026-09-01T00:00:00.000Z',
      currentAllowancePeriodAllAccountEvents: 19_000_000n,
      overageAllowed: true,
      overageUsdPerMillion: '0.60',
    });
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
          workersLogsContract: contract,
          expectedDailyWorkerInvocations: 1_000_000n,
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['savings_not_positive'],
    });
  });

  it('projects authenticated other-worker traffic through every remaining allowance day', async () => {
    const paidContract = {
      plan: 'paid' as const,
      allowanceEvents: 20_000_000n,
      allowancePeriod: 'billing_month' as const,
      allowancePeriodStartsAt: '2026-08-01T00:00:00.000Z',
      allowancePeriodEndsAt: '2026-09-01T00:00:00.000Z',
      currentAllowancePeriodAllAccountEvents: 1_000_000n,
      overageAllowed: true,
      overageUsdPerMillion: '0.60',
    };
    const withoutOtherWorkers = await currentWithWorkersLogsContract({
      ...paidContract,
      otherWorkersWorstCaseDailyLogEvents: 0n,
    });
    const withOtherWorkers = await currentWithWorkersLogsContract({
      ...paidContract,
      otherWorkersWorstCaseDailyLogEvents: 1_000_000n,
    });
    const input = {
      ...current,
      currentVercelAttributionUsd: '8.00',
      projectedEdgeCostUsd: '2.00',
      originCostProjection: {
        irreducibleDynamicOriginCostUsd: '2.00',
        reducibleStaticOriginCostUsd: '6.00',
      },
      expectedDailyWorkerInvocations: 143n,
    };

    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...input, workersLogsContract: withoutOtherWorkers },
        { now }
      )
    ).toEqual({ verdict: 'PROCEED', reasonCodes: [] });
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...input, workersLogsContract: withOtherWorkers },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['savings_not_positive'],
    });
  });

  it('includes other-worker volume in forced-sampling headroom', async () => {
    const withoutOtherWorkers = await currentWithWorkersLogsContract({
      currentUtcDayAllAccountEvents: 4_300_000_000n,
      otherWorkersWorstCaseDailyLogEvents: 0n,
    });
    const withOtherWorkers = await currentWithWorkersLogsContract({
      currentUtcDayAllAccountEvents: 4_300_000_000n,
      otherWorkersWorstCaseDailyLogEvents: 200_000_000n,
    });
    const input = {
      ...current,
      expectedDailyWorkerInvocations: 143n,
    };

    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...input, workersLogsContract: withoutOtherWorkers },
        { now }
      ).verdict
    ).toBe('PROCEED');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...input, workersLogsContract: withOtherWorkers },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['workers_logs_forced_sampling_headroom_insufficient'],
    });
  });

  it('fails closed when evaluation time is at or before the allowance period boundary', async () => {
    const contract = await currentWithWorkersLogsContract({
      plan: 'paid' as const,
      allowanceEvents: 20_000_000n,
      allowancePeriod: 'billing_month' as const,
      allowancePeriodStartsAt: '2026-08-01T00:00:00.000Z',
      allowancePeriodEndsAt: '2026-09-01T00:00:00.000Z',
      currentAllowancePeriodAllAccountEvents: 1_000_000n,
      overageAllowed: true,
      overageUsdPerMillion: '0.60',
    });
    const atEnd = evaluateOgabasseyOriginBusinessCase(
      {
        ...current,
        windowStart: '2026-08-24T00:00:00.000Z',
        windowEnd: '2026-08-31T00:00:00.000Z',
        observedAt: '2026-08-31T22:00:00.000Z',
        workersLogsContract: contract,
      },
      { now: new Date('2026-09-01T00:00:00.000Z'), maximumWindowAgeDays: 40 }
    );
    expect(atEnd.verdict).toBe('NOT_PROVEN');
    expect(atEnd.reasonCodes).toContain('workers_logs_projection_invalid');

    const widenedBaseline = evaluateOgabasseyOriginBusinessCase(current, {
      now: new Date('2026-09-01T00:00:00.000Z'),
      maximumWindowAgeDays: 40,
    });
    expect(widenedBaseline.reasonCodes).toContain('baseline_window_stale');

    const beforeStart = evaluateOgabasseyOriginBusinessCase(
      {
        ...current,
        windowStart: '2026-07-24T00:00:00.000Z',
        windowEnd: '2026-07-31T00:00:00.000Z',
        observedAt: '2026-07-31T22:00:00.000Z',
        workersLogsContract: contract,
      },
      { now: new Date('2026-07-31T23:00:00.000Z') }
    );
    expect(beforeStart.verdict).toBe('NOT_PROVEN');
    expect(beforeStart.reasonCodes).toContain(
      'workers_logs_projection_invalid'
    );
  });

  it('rejects an unparseable allowance period timestamp at contract retrieval', async () => {
    await expect(
      currentWithWorkersLogsContract({
        plan: 'paid' as const,
        allowanceEvents: 20_000_000n,
        allowancePeriod: 'billing_month' as const,
        allowancePeriodStartsAt: '2026-08-01T00:00:00.000Z',
        allowancePeriodEndsAt: 'not-a-timestamp',
        currentAllowancePeriodAllAccountEvents: 1_000_000n,
        overageAllowed: true,
        overageUsdPerMillion: '0.60',
      })
    ).rejects.toThrow();
  });
});
