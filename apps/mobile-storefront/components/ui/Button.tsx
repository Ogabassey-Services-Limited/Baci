/**
 * Button Component
 * Design aligned with Baci web app button variants
 * Supports: default, secondary, outline, ghost, destructive
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Colors, { BRAND, RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  variant = 'default',
  size = 'default',
  children,
  loading = false,
  fullWidth = false,
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'default':
        return {
          container: {
            backgroundColor: colors.primary,
          },
          text: {
            color: colors.primaryForeground,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.secondary,
          },
          text: {
            color: colors.secondaryForeground,
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.border,
          },
          text: {
            color: colors.foreground,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: colors.foreground,
          },
        };
      case 'destructive':
        return {
          container: {
            backgroundColor: colors.destructive,
          },
          text: {
            color: colors.destructiveForeground,
          },
        };
      default:
        return {
          container: {
            backgroundColor: colors.primary,
          },
          text: {
            color: colors.primaryForeground,
          },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            height: 36,
            paddingHorizontal: SPACING.sm,
            borderRadius: RADIUS.md,
          },
          text: {
            fontSize: TYPOGRAPHY.size.sm,
          },
        };
      case 'default':
        return {
          container: {
            height: 44, // WCAG touch target minimum
            paddingHorizontal: SPACING.md,
            borderRadius: RADIUS.md,
          },
          text: {
            fontSize: TYPOGRAPHY.size.sm,
          },
        };
      case 'lg':
        return {
          container: {
            height: 48,
            paddingHorizontal: SPACING.lg,
            borderRadius: RADIUS.lg,
          },
          text: {
            fontSize: TYPOGRAPHY.size.base,
          },
        };
      case 'icon':
        return {
          container: {
            height: 44,
            width: 44,
            paddingHorizontal: 0,
            borderRadius: RADIUS.md,
          },
          text: {
            fontSize: TYPOGRAPHY.size.base,
          },
        };
      default:
        return {
          container: {
            height: 44,
            paddingHorizontal: SPACING.md,
            borderRadius: RADIUS.md,
          },
          text: {
            fontSize: TYPOGRAPHY.size.sm,
          },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        sizeStyles.container,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.text.color}
        />
      ) : typeof children === 'string' ? (
        <Text
          style={[
            styles.text,
            sizeStyles.text,
            variantStyles.text,
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
});
