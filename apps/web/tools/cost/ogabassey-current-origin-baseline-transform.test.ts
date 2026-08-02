import { describe, expect, it } from 'vitest';
import { evaluateOgabasseyOriginBusinessCase } from './ogabassey-current-origin-baseline';
import { current } from './ogabassey-current-origin-baseline.test-fixtures';

const options = { now: new Date('2026-08-01T12:00:00.000Z') };

describe('Transform Rule capability gate', () => {
  it('stops when exact cookie-map capability is missing, unauthenticated, or unsupported', () => {
    for (const transformRuleCapability of [
      undefined,
      { ...current.transformRuleCapability, authenticated: false },
      { ...current.transformRuleCapability, supported: false },
    ]) {
      expect(
        evaluateOgabasseyOriginBusinessCase(
          { ...current, transformRuleCapability },
          options
        )
      ).toEqual({
        verdict: 'STOP',
        reasonCodes: ['transform_rule_capability_unavailable'],
      });
    }
  });

  it('stops when exact cookie-map capability lacks owner approval', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          transformRuleCapability: {
            ...current.transformRuleCapability,
            approved: false,
          },
        },
        options
      )
    ).toEqual({
      verdict: 'STOP',
      reasonCodes: ['transform_rule_capability_unapproved'],
    });
  });

  it('includes incremental zone-plan cost in the savings projection', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          transformRuleCapability: {
            ...current.transformRuleCapability,
            incrementalZonePlanCostUsd: '8.00',
          },
        },
        options
      )
    ).toEqual({ verdict: 'STOP', reasonCodes: ['savings_not_positive'] });
  });

  it('does not qualify an unparseable incremental zone-plan cost', () => {
    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...current,
          transformRuleCapability: {
            ...current.transformRuleCapability,
            incrementalZonePlanCostUsd: '1.001',
          },
        },
        options
      )
    ).toEqual({
      verdict: 'NOT_PROVEN',
      reasonCodes: ['transform_rule_zone_plan_cost_invalid'],
    });
  });
});
