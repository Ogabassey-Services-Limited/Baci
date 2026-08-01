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
});
