import type { ThemeColors } from '@/constants/theme';

export interface TaxCardShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export type TaxColors = ThemeColors;
