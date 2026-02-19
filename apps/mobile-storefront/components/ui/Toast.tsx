/**
 * Toast Component - 2026 Best Practice Implementation
 *
 * Features:
 * - Consistent styling across the app
 * - Auto-dismiss with configurable duration
 * - Proper cleanup to prevent memory leaks
 * - WCAG AA accessible with proper announcements
 * - Supports success, error, warning, and info variants
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors, { RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  visible: boolean;
  onDismiss: () => void;
  position?: 'top' | 'bottom';
}

export function Toast({
  message,
  variant = 'success',
  duration = 3000,
  visible,
  onDismiss,
  position = 'bottom',
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const theme = useColorScheme() ?? 'light';
  const colors = Colors[theme];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // M35 fix: Store onDismiss in a ref to avoid it being a dependency in useEffect.
  // When onDismiss is an inline function, it changes identity every render,
  // causing the useEffect to re-fire and potentially loop.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Cleanup timer on unmount or when visibility changes
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Auto-dismiss logic with proper cleanup
  // M35 fix: Use onDismissRef instead of onDismiss in deps to prevent infinite re-render
  // when onDismiss is an inline function that changes identity every render.
  useEffect(() => {
    if (visible && duration > 0) {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        onDismissRef.current();
        timerRef.current = null;
      }, duration);

      // Announce to screen readers for accessibility
      AccessibilityInfo.announceForAccessibility(message);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, duration, message]);

  if (!visible) return null;

  const positionStyle =
    position === 'top'
      ? { top: insets.top + 16 }
      : { bottom: insets.bottom + 100 };

  const getVariantConfig = (v: ToastVariant) => {
    switch (v) {
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          iconColor: colors.success,
          backgroundColor: colors.card,
          textColor: colors.text,
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          iconColor: colors.error,
          backgroundColor: colors.card,
          textColor: colors.text,
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          iconColor: colors.warning,
          backgroundColor: colors.card,
          textColor: colors.text,
        };
      case 'info':
        return {
          icon: 'information-circle' as const,
          iconColor: colors.text, // Fallback since no explicit info color
          backgroundColor: colors.card,
          textColor: colors.text,
        };
    }
  };

  const config = getVariantConfig(variant);

  return (
    <Animated.View
      entering={
        position === 'top' ? FadeIn.duration(200) : SlideInDown.duration(300)
      }
      exiting={
        position === 'top' ? FadeOut.duration(200) : SlideOutDown.duration(300)
      }
      style={[
        styles.container,
        positionStyle,
        { backgroundColor: config.backgroundColor },
      ]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <Ionicons name={config.icon} size={20} color={config.iconColor} />
      <Text style={[styles.message, { color: config.textColor }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

/**
 * useToast Hook - 2026 Best Practice
 * Provides a simple API for showing toasts with automatic cleanup
 */
export function useToast() {
  const [toastState, setToastState] = useState<{
    visible: boolean;
    message: string;
    variant: ToastVariant;
    duration: number;
  }>({
    visible: false,
    message: '',
    variant: 'success',
    duration: 3000,
  });

  const show = (
    message: string,
    options?: { variant?: ToastVariant; duration?: number }
  ) => {
    setToastState({
      visible: true,
      message,
      variant: options?.variant || 'success',
      duration: options?.duration || 3000,
    });
  };

  const hide = () => {
    setToastState((prev) => ({ ...prev, visible: false }));
  };

  const ToastComponent = () => (
    <Toast
      visible={toastState.visible}
      message={toastState.message}
      variant={toastState.variant}
      duration={toastState.duration}
      onDismiss={hide}
    />
  );

  return {
    show,
    hide,
    Toast: ToastComponent,
    // Convenience methods
    success: (message: string, duration?: number) =>
      show(message, { variant: 'success', duration }),
    error: (message: string, duration?: number) =>
      show(message, { variant: 'error', duration }),
    warning: (message: string, duration?: number) =>
      show(message, { variant: 'warning', duration }),
    info: (message: string, duration?: number) =>
      show(message, { variant: 'info', duration }),
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...SHADOWS.lg,
    zIndex: 9999,
  },
  message: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm, // Was 14
    fontWeight: TYPOGRAPHY.weight.semibold,
    lineHeight: 20, // Keep hardcoded or derive? 20 is ~1.4 * 14. Normal is 1.5. TYPOGRAPHY.lineHeight.normal is 1.5.
  },
});
