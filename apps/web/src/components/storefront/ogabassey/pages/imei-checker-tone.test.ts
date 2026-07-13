import { describe, expect, it } from 'vitest';
import { getVerdictTone, IMEI_TONES } from './imei-checker-tone';

describe('getVerdictTone', () => {
  it('returns the safe tone for verdictType "safe"', () => {
    expect(getVerdictTone('safe')).toBe(IMEI_TONES.safe);
  });

  it('returns the danger tone for verdictType "danger"', () => {
    expect(getVerdictTone('danger')).toBe(IMEI_TONES.danger);
  });

  it.each(['caution', null, undefined, 'unexpected-value'])(
    'falls back to the warning tone for %s',
    (verdictType) => {
      expect(getVerdictTone(verdictType)).toBe(IMEI_TONES.warning);
    }
  );
});
