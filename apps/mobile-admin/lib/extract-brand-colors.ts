/**
 * Brand Color Extraction Utility
 *
 * Extracts brand colors from a merchant's logo image using native
 * platform APIs (iOS UIImageColors, Android Palette).
 * Mirrors the web app's ColorThief-based extraction.
 */

import { getColors } from 'react-native-image-colors';

export interface BrandColors {
  primary: string;
  background: string;
  accent: string;
}

const DEFAULT_COLORS: BrandColors = {
  primary: '#3B82F6',
  background: '#FFFFFF',
  accent: '#F59E0B',
};

/**
 * Extract brand colors from an image URI.
 * Returns { primary, background, accent } matching the web app's BrandColors shape.
 */
export async function extractBrandColors(
  imageUri: string
): Promise<BrandColors> {
  try {
    const result = await getColors(imageUri, {
      fallback: '#3B82F6',
      cache: false,
      quality: 'high',
    });

    if (result.platform === 'ios') {
      return {
        primary: result.primary,
        background: '#FFFFFF',
        accent: result.secondary,
      };
    }

    if (result.platform === 'android') {
      return {
        primary: result.vibrant ?? result.dominant,
        background: '#FFFFFF',
        accent: result.lightVibrant ?? result.muted ?? result.dominant,
      };
    }

    // Web fallback (unlikely in RN but handle for completeness)
    if (result.platform === 'web') {
      return {
        primary: result.vibrant ?? result.dominant,
        background: '#FFFFFF',
        accent: result.lightVibrant ?? result.muted ?? result.dominant,
      };
    }

    return DEFAULT_COLORS;
  } catch (error) {
    if (__DEV__) {
      console.warn('[extractBrandColors] Failed:', error);
    }
    return DEFAULT_COLORS;
  }
}
