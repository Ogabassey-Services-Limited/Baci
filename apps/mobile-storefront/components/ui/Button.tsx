/**
 * Button Component
 * Design aligned with Baci web app button variants
 * Supports: default, secondary, outline, ghost, destructive
 */

import { cssInterop } from 'nativewind';
import type React from 'react';
import {
  ActivityIndicator,
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
  children: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  className?: string;
}

// Enable styling for Pressable via className if needed externally
cssInterop(Pressable, { className: 'style' });

export function Button({
  variant = 'default',
  size = 'default',
  children,
  loading = false,
  fullWidth = false,
  disabled,
  style,
  textStyle,
  className,
  ...props
}: ButtonProps) {
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

  // Loading indicator color logic
  const indicatorColor =
    variant === 'outline' || variant === 'ghost' ? 'black' : 'white'; // Simplification

  return (
    <Pressable
      className={`${containerClasses} ${className || ''}`}
      disabled={disabled || loading}
      style={style}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
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
