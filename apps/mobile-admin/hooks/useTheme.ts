/**
 * useTheme Hook
 * Returns theme colors based on system color scheme
 */

import { useColorScheme } from 'react-native';
import {
  DARK_COLORS,
  getChartColors,
  getShadows,
  LIGHT_COLORS,
  type ThemeColors,
} from '@/constants/theme';

interface ThemeResult {
  colors: ThemeColors;
  isDark: boolean;
  shadows: ReturnType<typeof getShadows>;
  chartColors: ReturnType<typeof getChartColors>;
}

export function useTheme(): ThemeResult {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
    isDark,
    shadows: getShadows(isDark),
    chartColors: getChartColors(isDark),
  };
}
