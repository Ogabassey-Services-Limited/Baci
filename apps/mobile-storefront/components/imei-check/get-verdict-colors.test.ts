import { getVerdictColors } from './get-verdict-colors';

describe('getVerdictColors', () => {
  it('returns safe colors', () => {
    expect(getVerdictColors('safe')).toEqual({
      bg: '#DEF7EC',
      border: '#A7F3D0',
      text: '#059669',
    });
  });

  it('returns caution colors', () => {
    expect(getVerdictColors('caution')).toEqual({
      bg: '#FEF3C7',
      border: '#FDE68A',
      text: '#D97706',
    });
  });

  it('returns danger colors', () => {
    expect(getVerdictColors('danger')).toEqual({
      bg: '#FEE2E2',
      border: '#FECACA',
      text: '#DC2626',
    });
  });
});
