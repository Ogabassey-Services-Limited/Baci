import { useColorScheme } from '@/components/useColorScheme';
import Colors, { SHADOWS } from '@/constants/Colors';

export type ThemeColors = typeof Colors.light;

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    colors: Colors[isDark ? 'dark' : 'light'] as ThemeColors,
    isDark,
    shadows: SHADOWS,
  };
}
