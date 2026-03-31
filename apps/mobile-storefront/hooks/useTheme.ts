import { useColorScheme } from '@/components/useColorScheme';
import Colors, { SHADOWS } from '@/constants/Colors';

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    colors: Colors[isDark ? 'dark' : 'light'],
    isDark,
    shadows: SHADOWS,
  };
}
