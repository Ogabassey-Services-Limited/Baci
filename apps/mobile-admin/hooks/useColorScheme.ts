/**
 * useColorScheme hook for Admin theme support
 */

import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme() {
  return useRNColorScheme() ?? 'light';
}
