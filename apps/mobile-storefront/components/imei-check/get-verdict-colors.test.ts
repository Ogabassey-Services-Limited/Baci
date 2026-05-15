import Colors from '@/constants/Colors';
import { getVerdictColors } from './get-verdict-colors';

describe('getVerdictColors', () => {
  const colors = Colors.light;

  it('returns safe colors', () => {
    expect(getVerdictColors('safe', colors)).toEqual({
      bg: '#D1FAE5',
      border: '#A7F3D0',
      text: '#059669',
    });
  });

  it('returns caution colors', () => {
    expect(getVerdictColors('caution', colors)).toEqual({
      bg: '#FEF3C7',
      border: '#FDE68A',
      text: '#D97706',
    });
  });

  it('returns danger colors', () => {
    expect(getVerdictColors('danger', colors)).toEqual({
      bg: '#FEE2E2',
      border: '#FECACA',
      text: '#DC2626',
    });
  });

  it.each([undefined, null, '', 'SAFE', 'unknown'])(
    'falls back to caution colors for unexpected verdict input: %s',
    (value) => {
      expect(getVerdictColors(value, colors)).toEqual(
        getVerdictColors('caution', colors)
      );
    }
  );

  it('matches verdict palettes snapshot for stable UI tokens', () => {
    expect({
      caution: getVerdictColors('caution', colors),
      danger: getVerdictColors('danger', colors),
      safe: getVerdictColors('safe', colors),
    }).toMatchInlineSnapshot(`
      {
        "caution": {
          "bg": "#FEF3C7",
          "border": "#FDE68A",
          "text": "#D97706",
        },
        "danger": {
          "bg": "#FEE2E2",
          "border": "#FECACA",
          "text": "#DC2626",
        },
        "safe": {
          "bg": "#D1FAE5",
          "border": "#A7F3D0",
          "text": "#059669",
        },
      }
    `);
  });
});
