import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Image, type ImageProps } from 'expo-image';
import { useRef, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

// Default blurhash for smooth loading placeholder
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
}

export function SafeImage({
  source,
  style,
  placeholder,
  transition = 300,
  cachePolicy = 'memory-disk',
  contentFit = 'cover',
  onLoadError,
  fallbackComponent,
  showFallbackIcon = true,
  fallbackStyle,
  fallbackIconSize = 32,
  fallbackIconColor = '#9CA3AF',
  ...rest
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // Refs to avoid stale closures — React Compiler handles memoization,
  // so we don't use manual useCallback. Refs ensure the error handler
  // always reads the current prop values.
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;
  const sourceRef = useRef(source);
  sourceRef.current = source;

  // Handle image load errors gracefully
  const handleError = (error: { error: string }) => {
    // Prevent infinite error loops
    if (errorCount >= 2) return;

    setErrorCount((prev) => prev + 1);
    setHasError(true);

    // Log for debugging in development
    if (__DEV__) {
      console.warn(
        '[SafeImage] Image load failed:',
        error.error,
        '\nSource:',
        sourceRef.current
      );
    }

    // Call optional error callback using ref to avoid stale closure
    if (onLoadErrorRef.current) {
      onLoadErrorRef.current(new Error(error.error));
    }
  };

  // Reset error state when source changes
  const handleLoadStart = () => {
    if (hasError) {
      setHasError(false);
      setErrorCount(0);
    }
  };

  // If we have a custom fallback component, use it
  if (hasError && fallbackComponent) {
    return <>{fallbackComponent}</>;
  }

  // If error and showFallbackIcon, render placeholder view
  if (hasError && showFallbackIcon) {
    return (
      <View
        style={[styles.fallbackContainer, style, fallbackStyle]}
        accessibilityLabel="Image unavailable"
      >
        <Ionicons
          name="image-outline"
          size={fallbackIconSize}
          color={fallbackIconColor}
        />
      </View>
    );
  }

  // Determine placeholder - use provided or default blurhash
  const effectivePlaceholder = placeholder || { blurhash: DEFAULT_BLURHASH };

  return (
    <Image
      source={source}
      style={style}
      placeholder={effectivePlaceholder}
      transition={transition}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
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
