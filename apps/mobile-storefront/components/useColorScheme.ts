import { useColorScheme as useRNColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores/settings-store';

/**
 * Enhanced useColorScheme that respects user appearance preference.
 * - 'system' → defers to RN useColorScheme() (null/unspecified treated as 'light')
 * - 'light' / 'dark' → forced override
 */
export function useColorScheme(): 'light' | 'dark' {
  const appearance = useSettingsStore((s) => s.appearance);
  const systemScheme = useRNColorScheme();

  if (appearance === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }

  return appearance;
}
