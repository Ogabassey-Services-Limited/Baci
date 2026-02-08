/**
 * useHapticFeedback Hook
 * Platform-aware haptic feedback utility
 *
 * 2026 Best Practices:
 * - Platform check (no haptics on web)
 * - Multiple feedback styles
 * - Centralized haptic logic
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type HapticStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

interface UseHapticFeedbackReturn {
  /** Trigger haptic feedback with specified style */
  triggerHaptic: (style?: HapticStyle) => void;
  /** Whether haptics are supported on this platform */
  isSupported: boolean;
}

const styleMap: Record<HapticStyle, () => Promise<void>> = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  selection: () => Haptics.selectionAsync(),
  success: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

export function useHapticFeedback(): UseHapticFeedbackReturn {
  const isSupported = Platform.OS !== 'web';

  const triggerHaptic = (style: HapticStyle = 'light') => {
    if (!isSupported) return;

    const hapticFn = styleMap[style];
    if (hapticFn) {
      hapticFn().catch(() => {
        // Silently fail if haptics unavailable
      });
    }
  };

  return {
    triggerHaptic,
    isSupported,
  };
}
