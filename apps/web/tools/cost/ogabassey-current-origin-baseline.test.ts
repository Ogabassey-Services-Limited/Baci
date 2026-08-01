import { describe, expect, it } from 'vitest';
import { evaluateOgabasseyOriginBusinessCase } from './ogabassey-current-origin-baseline';

const current = {
  windowDays: 7,
  windowStart: '2026-07-25T00:00:00.000Z',
  windowEnd: '2026-08-01T00:00:00.000Z',
  observedAt: '2026-08-01T11:00:00.000Z',
  allIngressRequests: 1000,
  allIngressOriginAttempts: 20,
  discoveredHostnames: [
    'ogabassey.com',
    'ogabassey.usebaci.com',
    'www.ogabassey.com',
  ],
  completeHostEvidence: true,
  currentVercelAttributionUsd: '12.00',
  projectedEdgeCostUsd: '2.00',
  ownerApprovedPaybackMonths: 12,
  paybackMonths: 2,
};
describe('evaluateOgabasseyOriginBusinessCase', () => {
  it('proceeds only on a current complete all-ingress seven-day baseline with positive savings', () =>
    expect(
      evaluateOgabasseyOriginBusinessCase(current, {
        now: new Date('2026-08-01T12:00:00.000Z'),
      }).verdict
    ).toBe('PROCEED'));
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
  it('rejects impossible origin-attempt aggregates and non-finite payback', () => {
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
      ).reasonCodes
    ).toContain('payback_invalid');
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
});
