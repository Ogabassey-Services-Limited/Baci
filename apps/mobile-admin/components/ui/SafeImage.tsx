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
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageErrorEventData,
  type ImageProps,
  type ImageSourcePropType,
  type NativeSyntheticEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { SvgUri, SvgXml } from 'react-native-svg';

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
  const [xml, setXml] = useState<string | null>(null);
  const [isLoadingXml, setIsLoadingXml] = useState(false);

  // SVG Detection Logic
  const uri =
    typeof source === 'object' && source !== null && 'uri' in source
      ? (source as { uri?: string }).uri
      : undefined;

  const isSvg =
    typeof uri === 'string' &&
    (uri.toLowerCase().includes('.svg') ||
      uri.startsWith('data:image/svg+xml'));

  // Fetch SVG XML for more reliable rendering
  useEffect(() => {
    let isMounted = true;

    const fetchSvg = async () => {
      if (!isSvg || !uri || uri.startsWith('data:')) return;

      setIsLoadingXml(true);
      try {
        const response = await fetch(uri);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();

        if (isMounted) {
          if (!text || text.trim().length === 0) {
            console.warn('[SafeImage] SVG content is empty for uri:', uri);
            setHasError(true);
            setIsLoadingXml(false);
            return;
          }
          setXml(text);
          setIsLoadingXml(false);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('[SafeImage] SVG XML fetch failed:', err);
          setIsLoadingXml(false);
          setHasError(true);
        }
      }
    };

    fetchSvg();
    return () => {
      isMounted = false;
    };
  }, [isSvg, uri]);

  // Handle image load errors gracefully
  const handleError = (e: NativeSyntheticEvent<ImageErrorEventData>) => {
    // Prevent infinite error loops
    if (errorCount >= 2) return;

    setErrorCount((prev) => prev + 1);
    setHasError(true);

    const errorMessage = e?.nativeEvent?.error || 'Unknown image loading error';

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
  };

  // Reset error state when source changes
  const handleLoadStart = () => {
    if (hasError) {
      setHasError(false);
      setErrorCount(0);
    }
    if (propsOnLoadStart) {
      propsOnLoadStart();
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

  // Render SVG if XML is loaded or if it's a data URI
  if (isSvg && !hasError) {
    if (isLoadingXml) {
      return (
        <View style={[style, styles.loadingContainer]}>
          <ActivityIndicator size="small" color="#9CA3AF" />
        </View>
      );
    }

    const flattenedStyle = StyleSheet.flatten(style);
    const svgWidth =
      typeof flattenedStyle?.width === 'number' ? flattenedStyle.width : 48;
    const svgHeight =
      typeof flattenedStyle?.height === 'number' ? flattenedStyle.height : 48;

    if (uri?.startsWith('data:image/svg+xml')) {
      // Data URI - use SvgXml with direct mapping
      return (
        <View style={[style, styles.svgWrapper]}>
          <SvgUri
            uri={uri}
            width={svgWidth}
            height={svgHeight}
            onError={() => setHasError(true)}
          />
        </View>
      );
    }

    if (xml) {
      return (
        <View style={[style, styles.svgWrapper]}>
          <SvgXml xml={xml} width={svgWidth} height={svgHeight} />
        </View>
      );
    }
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  svgWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SafeImage;
