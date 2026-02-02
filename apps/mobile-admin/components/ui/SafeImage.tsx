/**
 * SafeImage Component
 *
 * A wrapper around expo-image that handles iOS CoreGraphics errors
 * for unsupported image formats (24-bpp PNG, certain color spaces).
 *
 * iOS Bug Reference: rdar://143602439
 *
 * When an image fails to load, this component gracefully falls back
 * to a placeholder or cached image instead of crashing the app.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  Image,
  type ImageProps,
  type ImageSourcePropType,
  type ImageErrorEventData,
  type NativeSyntheticEvent,
} from 'react-native';

// Default blurhash for smooth loading placeholder
// (Kept for interface compatibility even if not used by native Image)
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7RjE1%MWBR*';

export interface SafeImageProps extends Omit<ImageProps, 'onError'> {
  /**
   * Optional callback when image fails to load
   */
  onLoadError?: (error: Error) => void;
  /**
   * Custom fallback component to render on error
   */
  fallbackComponent?: React.ReactNode;
  /**
   * Whether to show a placeholder icon on error (default: true)
   */
  showFallbackIcon?: boolean;
  /**
   * Container style for the fallback view
   */
  fallbackStyle?: StyleProp<ViewStyle>;
  /**
   * Fallback icon size (default: 32)
   */
  fallbackIconSize?: number;
  /**
   * Fallback icon color (default: #9CA3AF - gray-400)
   */
  fallbackIconColor?: string;
  /**
   * Compatibility props for expo-image (ignored by native Image)
   */
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  placeholder?: string | { blurhash: string };
  transition?: number;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
}

function SafeImage({
  source,
  style,
  placeholder: _placeholder,
  transition: _transition,
  cachePolicy: _cachePolicy,
  contentFit = 'cover',
  onLoadError,
  onLoadStart: propsOnLoadStart,
  fallbackComponent,
  showFallbackIcon = true,
  fallbackStyle,
  fallbackIconSize = 32,
  fallbackIconColor = '#9CA3AF',
  ...rest
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // Handle image load errors gracefully
  const handleError = useCallback(
    (e: NativeSyntheticEvent<ImageErrorEventData>) => {
      // Prevent infinite error loops
      if (errorCount >= 2) return;

      setErrorCount((prev) => prev + 1);
      setHasError(true);

      const errorMessage =
        e?.nativeEvent?.error || 'Unknown image loading error';

      // Log for debugging in development
      if (__DEV__) {
        console.warn(
          '[SafeImage] Image load failed:',
          errorMessage,
          '\nSource:',
          source
        );
      }

      // Call optional error callback
      if (onLoadError) {
        onLoadError(new Error(errorMessage));
      }
    },
    [errorCount, onLoadError, source]
  );

  // Reset error state when source changes
  const handleLoadStart = useCallback(() => {
    if (hasError) {
      setHasError(false);
      setErrorCount(0);
    }
    if (propsOnLoadStart) {
      propsOnLoadStart();
    }
  }, [hasError, propsOnLoadStart]);

  // If we have a custom fallback component, use it
  if (hasError && fallbackComponent) {
    return <>{fallbackComponent}</>;
  }

  // If error and showFallbackIcon, render placeholder view
  if (hasError && showFallbackIcon) {
    return (
      <View
        style={[
          styles.fallbackContainer,
          style as StyleProp<ViewStyle>,
          fallbackStyle,
        ]}
      >
        <Ionicons
          name="image-outline"
          size={fallbackIconSize}
          color={fallbackIconColor}
        />
      </View>
    );
  }

  // Map contentFit (expo-image) to resizeMode (react-native)
  let resizeMode: 'cover' | 'contain' | 'stretch' | 'center' = 'cover';
  if (contentFit === 'contain') resizeMode = 'contain';
  if (contentFit === 'fill') resizeMode = 'stretch';
  if (contentFit === 'none') resizeMode = 'center';

  // NOTE: Completely isolated from expo-image due to iOS CoreGraphics crash
  // related to 24-bpp PNGs and color spaces (rdar://143602439)
  return (
    <Image
      source={source as ImageSourcePropType}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
      onLoadStart={handleLoadStart}
      {...rest}
    />
  );
}

/**
 * Helper hook to create SafeImage props with common settings
 */
export function useSafeImageProps(blurhash?: string) {
  return {
    placeholder: { blurhash: blurhash || DEFAULT_BLURHASH },
    transition: 300,
    cachePolicy: 'memory-disk' as const,
    contentFit: 'cover' as const,
  };
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SafeImage;
