import { describe, expect, it } from 'vitest';
import { evaluatePetrockRemediationEligibility } from './petrock-remediation-eligibility';

const baseResult = {
  blacklistStatus: 'Clean',
  carrier: 'US AT&T',
  device: 'iPhone 17 Pro Max',
  financeStatus: 'Clean',
  simLock: 'Locked',
};

const product = {
  carrier: 'AT&T',
  id: 'product-1',
  manualDisabled: false,
  modelScope: { kind: 'range' as const, max: 17, min: 17 },
  statusSegment: 'clean',
};

describe('evaluatePetrockRemediationEligibility', () => {
  it('offers only a clean, carrier-locked, model-matched product', () => {
    expect(
      evaluatePetrockRemediationEligibility({
        products: [product],
        result: baseResult,
      })
    ).toEqual({ kind: 'eligible', productIds: ['product-1'] });
  });

  it.each([
    'Blacklisted',
    'Lost or Stolen',
    'Blocked',
    'Clean / Reported Lost',
  ])('suppresses a risky blacklist value: %s', (blacklistStatus) => {
    expect(
      evaluatePetrockRemediationEligibility({
        products: [product],
        result: { ...baseResult, blacklistStatus },
      })
    ).toMatchObject({ kind: 'suppressed', reason: 'blacklist_risk' });
  });

  it('suppresses an ambiguous finance status containing a blacklist risk', () => {
    expect(
      evaluatePetrockRemediationEligibility({
        products: [product],
        result: { ...baseResult, financeStatus: 'Clean / Blacklisted' },
      })
    ).toMatchObject({ kind: 'suppressed', reason: 'carrier_status_risk' });
  });

  it('requests missing checks in carrier, blacklist, status order', () => {
    expect(
      evaluatePetrockRemediationEligibility({
        products: [product],
        result: {
          blacklistStatus: 'Unknown',
          carrier: 'Unknown',
          device: 'iPhone 17 Pro Max',
          simLock: 'Locked',
        },
      })
    ).toEqual({
      checks: ['carrier_detection', 'blacklist', 'carrier_status'],
      kind: 'checks_required',
    });
  });

  it('uses the carrier-detection check when SIM-lock evidence is unknown', () => {
    expect(
      evaluatePetrockRemediationEligibility({
        products: [product],
        result: { ...baseResult, simLock: 'Unknown' },
      })
    ).toEqual({
      checks: ['carrier_detection'],
      kind: 'checks_required',
    });
  });

  it('suppresses unlocked, unknown-carrier, unmatched, and disabled offers', () => {
    expect(
      evaluatePetrockRemediationEligibility({
        products: [product],
        result: { ...baseResult, simLock: 'Unlocked' },
      })
    ).toMatchObject({ kind: 'suppressed', reason: 'not_carrier_locked' });
    expect(
      evaluatePetrockRemediationEligibility({
        products: [{ ...product, manualDisabled: true }],
        result: baseResult,
      })
    ).toMatchObject({ kind: 'suppressed', reason: 'no_matching_product' });
  });
});
