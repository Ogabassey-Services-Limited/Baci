import type { ImeiCheckerColors } from './imei-check.types';
import {
  createImeiVerdictPalette,
  IMEI_LIGHT_VERDICT_PALETTES,
} from './imei-check-theme';

export type ImeiVerdictType = 'safe' | 'caution' | 'danger';

export function getVerdictColors(
  type: ImeiVerdictType | string | null | undefined,
  colors: ImeiCheckerColors
) {
  const themePalettes = {
    caution: createImeiVerdictPalette(colors.warning),
    danger: createImeiVerdictPalette(colors.error),
    safe: createImeiVerdictPalette(colors.success),
  } as const;

  if (colors.background === colors.white) {
    const lightPalette =
      type === 'safe' || type === 'danger' || type === 'caution'
        ? type
        : 'caution';
    return IMEI_LIGHT_VERDICT_PALETTES[lightPalette];
  }

  switch (type) {
    case 'safe':
      return themePalettes.safe;
    case 'caution':
      return themePalettes.caution;
    case 'danger':
      return themePalettes.danger;
    default:
      return themePalettes.caution;
  }
}
