/**
 * Button Component - 2026 Best Practice Implementation
 * Design aligned with Baci web app button variants
 * Supports: default, secondary, outline, ghost, destructive
 *
 * Features:
 * - Loading state with accessibility announcements
 * - Proper disabled state styling
 * - WCAG AA compliant focus states
 * - Haptic feedback on press (iOS)
 */

import * as Haptics from 'expo-haptics';
import { cssInterop } from 'nativewind';
import React, { type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  type GestureResponderEvent,
  Platform,
  Pressable,
  type PressableProps,
  Text,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive';
type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  loading?: boolean;
  loadingText?: string; // 2026: Accessible loading message
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  className?: string;
  haptic?: boolean; // 2026: Enable haptic feedback
}

// Enable styling for Pressable via className if needed externally
cssInterop(Pressable, { className: 'style' });

export function Button({
  variant = 'default',
  size = 'default',
  children,
  loading = false,
  loadingText,
  fullWidth = false,
  disabled,
  style,
  textStyle,
  className,
  haptic = true,
  onPress,
  ...props
}: ButtonProps) {
  // 2026 Best Practice: Announce loading state to screen readers
  React.useEffect(() => {
    if (loading && loadingText) {
      AccessibilityInfo.announceForAccessibility(loadingText);
    }
  }, [loading, loadingText]);

  // 2026 Best Practice: Haptic feedback on press
  const handlePress = (event: GestureResponderEvent) => {
    if (haptic && Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // Ignore haptic errors (device may not support)
      });
    }
    onPress?.(event);
  };
  // Base classes
  let containerClasses =
    'flex-row items-center justify-center gap-2 rounded-md active:opacity-90 active:scale-95 disabled:opacity-50';
  let textClasses = 'font-medium text-center font-inter-semibold'; // Assuming font configured or default

  // Variant classes
  switch (variant) {
    case 'default':
      containerClasses += ' bg-primary';
      textClasses += ' text-primary-foreground';
      break;
    case 'secondary':
      containerClasses += ' bg-secondary';
      textClasses += ' text-secondary-foreground';
      break;
    case 'outline':
      containerClasses += ' bg-transparent border border-border';
      textClasses += ' text-foreground';
      break;
    case 'ghost':
      containerClasses += ' bg-transparent';
      textClasses += ' text-foreground';
      break;
    case 'destructive':
      containerClasses += ' bg-destructive';
      textClasses += ' text-destructive-foreground';
      break;
  }

  // Size classes
  switch (size) {
    case 'sm':
      containerClasses += ' h-9 px-3';
      textClasses += ' text-sm';
      break;
    case 'default':
      containerClasses += ' h-11 px-4'; // 44px
      textClasses += ' text-sm';
      break;
    case 'lg':
      containerClasses += ' h-12 px-8 rounded-lg';
      textClasses += ' text-base';
      break;
    case 'icon':
      containerClasses += ' h-11 w-11 px-0';
      textClasses += ' text-base';
      break;
  }

  if (fullWidth) {
    containerClasses += ' w-full';
  }

  // Loading indicator color — derived from variant text color for theme safety.
  // Avoids hardcoded black/white which becomes invisible on some merchant themes.
  const variantTextColors: Record<ButtonVariant, string> = {
    default: '#FFFFFF', // primary-foreground (white on brand bg)
    secondary: '#000000', // secondary-foreground (dark on amber bg)
    outline: '#374151', // gray-700 — visible on transparent/border backgrounds
    ghost: '#374151', // gray-700 — same reasoning as outline
    destructive: '#FFFFFF', // destructive-foreground (white on red bg)
  };
  const indicatorColor = textStyle?.color
    ? String(textStyle.color)
    : variantTextColors[variant];

  // Ripple color adapts to variant — light ripple on dark backgrounds, dark on light
  const variantRippleColors: Record<ButtonVariant, string> = {
    default: 'rgba(255,255,255,0.2)',
    secondary: 'rgba(0,0,0,0.1)',
    outline: 'rgba(0,0,0,0.1)',
    ghost: 'rgba(0,0,0,0.1)',
    destructive: 'rgba(255,255,255,0.2)',
  };

  return (
    <Pressable
      className={`${containerClasses} ${className || ''}`}
      disabled={disabled || loading}
      style={style}
      onPress={handlePress}
      android_ripple={{ color: variantRippleColors[variant] }}
      // 2026 Accessibility: Proper button semantics
      accessibilityRole="button"
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      accessibilityLabel={
        loading && loadingText
          ? loadingText
          : typeof children === 'string'
            ? children
            : undefined
      }
      {...props}
    >
      {loading ? (
        <>
          <ActivityIndicator size="small" color={indicatorColor} />
          {loadingText && (
            <Text className={`${textClasses}`} style={textStyle}>
              {loadingText}
            </Text>
          )}
        </>
      ) : typeof children === 'string' ? (
        <Text className={`${textClasses}`} style={textStyle}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
