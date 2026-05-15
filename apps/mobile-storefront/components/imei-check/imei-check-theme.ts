import { palette, withAlpha } from '@/constants/Colors';
import { Platform } from 'react-native';

export const IMEI_MONOSPACE_FONT =
  Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export interface ImeiVerdictPalette {
  bg: string;
  border: string;
  text: string;
}

export function createImeiVerdictPalette(color: string): ImeiVerdictPalette {
  return {
    bg: withAlpha(color, 0.14),
    border: withAlpha(color, 0.32),
    text: color,
  };
}

export const IMEI_LIGHT_VERDICT_PALETTES = {
  caution: {
    bg: palette.amber[100],
    border: palette.amber[200],
    text: palette.amber[600],
  },
  danger: {
    bg: palette.red[100],
    border: palette.red[200],
    text: palette.red[600],
  },
  safe: {
    bg: palette.emerald[100],
    border: palette.emerald[200],
    text: palette.emerald[600],
  },
} as const satisfies Record<'safe' | 'caution' | 'danger', ImeiVerdictPalette>;
