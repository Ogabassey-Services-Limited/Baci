import { describe, expect, it } from 'vitest';
import { evaluateOgabasseyOriginBusinessCase } from './ogabassey-current-origin-baseline';
import {
  current,
  currentWithWorkersLogsContract,
} from './ogabassey-current-origin-baseline.test-fixtures';

function withCanonicalOriginAttempts(originAttemptCount: number) {
  return {
    ...current,
    allIngressOriginAttempts: originAttemptCount,
    hostEvidence: current.hostEvidence.map((row, index) =>
      index === 0
        ? {
            ...row,
            originAttemptCount,
            eligibleStaticOriginAttemptCount: originAttemptCount,
          }
        : row
    ),
  };
}

describe('evaluateOgabasseyOriginBusinessCase', () => {
  it('proceeds only on a current complete all-ingress seven-day baseline with positive savings', () =>
    expect(
      evaluateOgabasseyOriginBusinessCase(current, {
        now: new Date('2026-08-01T12:00:00.000Z'),
      }).verdict
    ).toBe('PROCEED'));
  it('stops before cost or payback evaluation when the origin-avoidance target is met', () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...withCanonicalOriginAttempts(0),
          currentVercelAttributionUsd: undefined,
          projectedEdgeCostUsd: undefined,
          ownerApprovedPaybackMonths: undefined,
          paybackMonths: undefined,
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['origin_avoidance_target_met'],
    });
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...withCanonicalOriginAttempts(1),
          currentVercelAttributionUsd: undefined,
          projectedEdgeCostUsd: undefined,
          ownerApprovedPaybackMonths: undefined,
          paybackMonths: undefined,
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['origin_avoidance_target_met'],
    });
  });
  it('rejects percentage-only, apex-only, stale, or incomplete evidence', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, allIngressRequests: undefined },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      ).verdict
    ).toBe('NOT_PROVEN');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          discoveredHostnames: ['ogabassey.com', 'www.ogabassey.com'],
        },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      ).verdict
    ).toBe('NOT_PROVEN');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, windowDays: 6 },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      ).verdict
    ).toBe('NOT_PROVEN');
  });
  it('rejects impossible origin-attempt aggregates and ignores legacy payback', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, allIngressOriginAttempts: -1 },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      ).reasonCodes
    ).toContain('origin_attempt_count_invalid');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, allIngressOriginAttempts: 1001 },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      ).reasonCodes
    ).toContain('origin_attempt_count_invalid');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, paybackMonths: Number.NaN },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      )
    ).toEqual({ verdict: 'PROCEED', reasonCodes: [] });
  });
  it('does not treat malformed cost evidence as a savings STOP', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, currentVercelAttributionUsd: 'not-usd' },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      )
    ).toEqual({
      verdict: 'NOT_PROVEN',
      reasonCodes: ['cost_input_invalid'],
    });
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, projectedEdgeCostUsd: '$2.00' },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      )
    ).toEqual({
      verdict: 'NOT_PROVEN',
      reasonCodes: ['cost_input_invalid'],
    });
  });
  it('does not proceed from a favorable price without validated Workers Logs evidence', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          workersLogsContract: undefined,
        } as unknown as typeof current,
        { now: new Date('2026-08-01T12:00:00.000Z') }
      )
    ).toEqual({
      verdict: 'NOT_PROVEN',
      reasonCodes: ['workers_logs_contract_invalid'],
    });
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          workersLogsContract: Object.fromEntries(
            Object.entries(current.workersLogsContract).filter(
              ([key]) => key !== 'provenance'
            )
          ),
        } as unknown as typeof current,
        { now: new Date('2026-08-01T12:00:00.000Z') }
      )
    ).toEqual({
      verdict: 'NOT_PROVEN',
      reasonCodes: ['workers_logs_contract_invalid'],
    });
  });
  it('rejects exhausted Free allowance and insufficient forced-sampling headroom', async () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    const exhaustedContract = await currentWithWorkersLogsContract({
      currentAllowancePeriodAllAccountEvents: 200_000n,
    });
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          workersLogsContract: exhaustedContract,
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['workers_logs_allowance_exhausted'],
    });
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          expectedDailyWorkerInvocations: 1_250_000_000n,
        },
        { now }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['workers_logs_forced_sampling_headroom_insufficient'],
    });
  });
  it('rejects zero or understated expected daily invocations', () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    for (const expectedDailyWorkerInvocations of [0n, 142n]) {
      expect(
        evaluateOgabasseyOriginBusinessCase(
          { ...current, expectedDailyWorkerInvocations },
          { now }
        )
      ).toEqual({
        verdict: 'NOT_PROVEN',
        reasonCodes: ['workers_logs_projection_invalid'],
      });
    }
  });
  it('rejects an undated, future, stale, or calendar-invalid baseline window', () => {
    const now = new Date('2026-08-01T12:00:00.000Z');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, observedAt: undefined } as unknown as typeof current,
        { now }
      ).reasonCodes
    ).toContain('baseline_observation_invalid');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, observedAt: 'not-a-timestamp' },
        { now }
      ).reasonCodes
    ).toContain('baseline_observation_invalid');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, observedAt: '2026-07-31T23:59:59.999Z' },
        { now }
      ).reasonCodes
    ).toContain('baseline_observation_invalid');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, windowStart: undefined },
        { now }
      ).reasonCodes
    ).toContain('baseline_window_missing_or_invalid');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          windowStart: '2026-07-26T00:00:00.000Z',
          windowEnd: '2026-08-02T00:00:00.000Z',
        },
        { now }
      ).reasonCodes
    ).toContain('baseline_window_not_closed');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          windowStart: '2026-06-25T00:00:00.000Z',
          windowEnd: '2026-07-02T00:00:00.000Z',
        },
        { now }
      ).reasonCodes
    ).toContain('baseline_window_stale');
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          windowStart: '2026-02-30T00:00:00.000Z',
        },
        { now }
      ).reasonCodes
    ).toContain('baseline_window_missing_or_invalid');
  });
  it('stops when projected edge cost does not produce positive savings', () =>
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          currentVercelAttributionUsd: '2.00',
          originCostProjection: {
            irreducibleDynamicOriginCostUsd: '0.50',
            reducibleStaticOriginCostUsd: '1.50',
          },
        },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['savings_not_positive'],
    }));
  it('stops when payback exceeds the owner-approved horizon', () =>
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          verifiedUpfrontImplementationCostUsd: '104.00',
          paybackMonths: Number.NaN,
        },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['payback_exceeds_approved_horizon'],
    }));
  it('rejects a malformed verified implementation cost', () =>
    expect(
      evaluateOgabasseyOriginBusinessCase(
        { ...current, verifiedUpfrontImplementationCostUsd: '1.001' },
        { now: new Date('2026-08-01T12:00:00.000Z') }
      )
    ).toEqual({
      verdict: 'NOT_PROVEN',
      reasonCodes: ['implementation_cost_invalid'],
    }));
});
