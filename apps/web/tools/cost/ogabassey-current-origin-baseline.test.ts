import { describe, expect, it } from 'vitest';
import { evaluateOgabasseyOriginBusinessCase } from './ogabassey-current-origin-baseline';

const current = {
  windowDays: 7,
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
    expect(evaluateOgabasseyOriginBusinessCase(current).verdict).toBe(
      'PROCEED'
    ));
  it('rejects percentage-only, apex-only, stale, or incomplete evidence', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase({
        ...current,
        allIngressRequests: undefined,
      }).verdict
    ).toBe('NOT_PROVEN');
    expect(
      evaluateOgabasseyOriginBusinessCase({
        ...current,
        discoveredHostnames: ['ogabassey.com', 'www.ogabassey.com'],
      }).verdict
    ).toBe('NOT_PROVEN');
    expect(
      evaluateOgabasseyOriginBusinessCase({ ...current, windowDays: 6 }).verdict
    ).toBe('NOT_PROVEN');
  });
  it('rejects impossible origin-attempt aggregates and non-finite payback', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase({
        ...current,
        allIngressOriginAttempts: -1,
      }).reasonCodes
    ).toContain('origin_attempt_count_invalid');
    expect(
      evaluateOgabasseyOriginBusinessCase({
        ...current,
        allIngressOriginAttempts: 1001,
      }).reasonCodes
    ).toContain('origin_attempt_count_invalid');
    expect(
      evaluateOgabasseyOriginBusinessCase({
        ...current,
        paybackMonths: Number.NaN,
      }).reasonCodes
    ).toContain('payback_invalid');
  });
});
