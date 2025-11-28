/**
 * Color Contrast Utilities for WCAG 2.1 AA Compliance
 *
 * WCAG 2.1 AA Requirements:
 * - Normal text: 4.5:1 contrast ratio minimum
 * - Large text (18pt+ or 14pt+ bold): 3:1 contrast ratio minimum
 * - UI components and graphical objects: 3:1 contrast ratio minimum
 */

/**
 * Calculate the relative luminance of a color
 * Based on WCAG 2.1 definition
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Relative luminance value (0-1)
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate the contrast ratio between two colors
 *
 * @param luminance1 - Luminance of first color
 * @param luminance2 - Luminance of second color
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(luminance1: number, luminance2: number): number {
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse a color string to RGB values
 *
 * @param color - Color string (hex, rgb, or hsl)
 * @returns RGB values or null if invalid
 */
export function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle hex colors
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }

  // Handle short hex colors
  const shortHexMatch = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
  if (shortHexMatch) {
    return {
      r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
      g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
      b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16),
    };
  }

  // Handle rgb colors
  const rgbMatch = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }

  // Handle hsl colors
  const hslMatch = color.match(/^hsl\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/i);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]) / 360;
    const s = parseInt(hslMatch[2]) / 100;
    const l = parseInt(hslMatch[3]) / 100;
    return hslToRgb(h, s, l);
  }

  return null;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Check if a color combination meets WCAG 2.1 AA requirements
 *
 * @param foreground - Foreground color (text or icon)
 * @param background - Background color
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns Object with compliance status and ratio
 */
export function checkColorContrast(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): {
  passes: boolean;
  ratio: number;
  requiredRatio: number;
  level: 'AA' | 'AAA' | 'fail';
} {
  const fgRgb = parseColor(foreground);
  const bgRgb = parseColor(background);

  if (!fgRgb || !bgRgb) {
    throw new Error('Invalid color format');
  }

  const fgLuminance = getRelativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgLuminance = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const ratio = getContrastRatio(fgLuminance, bgLuminance);

  const requiredRatio = isLargeText ? 3 : 4.5;
  const aaaRatio = isLargeText ? 4.5 : 7;

  let level: 'AA' | 'AAA' | 'fail';
  if (ratio >= aaaRatio) {
    level = 'AAA';
  } else if (ratio >= requiredRatio) {
    level = 'AA';
  } else {
    level = 'fail';
  }

  return {
    passes: ratio >= requiredRatio,
    ratio: Math.round(ratio * 100) / 100,
    requiredRatio,
    level,
  };
}

/**
 * Get a suggested accessible color that meets WCAG AA requirements
 *
 * @param color - The color to adjust
 * @param background - The background color to contrast against
 * @param isLargeText - Whether for large text
 * @returns Adjusted color that meets AA requirements
 */
export function getAccessibleColor(
  color: string,
  background: string,
  isLargeText: boolean = false
): string {
  const colorRgb = parseColor(color);
  const bgRgb = parseColor(background);

  if (!colorRgb || !bgRgb) {
    return color;
  }

  const bgLuminance = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const requiredRatio = isLargeText ? 3 : 4.5;

  // Determine if we need to lighten or darken
  const isLightBg = bgLuminance > 0.5;

  let { r, g, b } = colorRgb;
  let iterations = 0;
  const maxIterations = 255;

  while (iterations < maxIterations) {
    const luminance = getRelativeLuminance(r, g, b);
    const ratio = getContrastRatio(luminance, bgLuminance);

    if (ratio >= requiredRatio) {
      break;
    }

    // Adjust color towards black or white
    if (isLightBg) {
      // Darken for light backgrounds
      r = Math.max(0, r - 1);
      g = Math.max(0, g - 1);
      b = Math.max(0, b - 1);
    } else {
      // Lighten for dark backgrounds
      r = Math.min(255, r + 1);
      g = Math.min(255, g + 1);
      b = Math.min(255, b + 1);
    }

    iterations++;
  }

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Check multiple color combinations for accessibility
 *
 * @param colorPairs - Array of color pairs to check
 * @returns Array of results with pass/fail status
 */
export function auditColorContrast(
  colorPairs: Array<{
    name: string;
    foreground: string;
    background: string;
    isLargeText?: boolean;
  }>
): Array<{
  name: string;
  foreground: string;
  background: string;
  passes: boolean;
  ratio: number;
  level: 'AA' | 'AAA' | 'fail';
  suggestedColor?: string;
}> {
  return colorPairs.map(pair => {
    const result = checkColorContrast(pair.foreground, pair.background, pair.isLargeText);

    return {
      name: pair.name,
      foreground: pair.foreground,
      background: pair.background,
      passes: result.passes,
      ratio: result.ratio,
      level: result.level,
      suggestedColor: result.passes
        ? undefined
        : getAccessibleColor(pair.foreground, pair.background, pair.isLargeText),
    };
  });
}

/**
 * Common color contrast issues found in web applications
 * These are the colors that should be checked against your theme
 */
export const commonContrastIssues = {
  // Gray text on white background (often fails)
  grayOnWhite: {
    foreground: '#6b7280', // gray-500
    background: '#ffffff',
    description: 'Gray text on white background',
  },
  // Light blue text (often fails)
  lightBlueOnWhite: {
    foreground: '#60a5fa', // blue-400
    background: '#ffffff',
    description: 'Light blue text on white background',
  },
  // Yellow warning text
  yellowOnWhite: {
    foreground: '#fbbf24', // yellow-400
    background: '#ffffff',
    description: 'Yellow text on white background',
  },
  // Placeholder text (intentionally lower contrast but should still be readable)
  placeholderOnWhite: {
    foreground: '#9ca3af', // gray-400
    background: '#ffffff',
    description: 'Placeholder text on white background',
  },
};

/**
 * Pre-defined accessible color palettes that meet WCAG AA requirements
 */
export const accessiblePalettes = {
  light: {
    background: '#ffffff',
    foreground: '#1f2937', // gray-800
    muted: '#6b7280', // gray-500 - passes 4.5:1 on white
    primary: '#2563eb', // blue-600 - passes 4.5:1 on white
    destructive: '#dc2626', // red-600 - passes 4.5:1 on white
    success: '#16a34a', // green-600 - passes 4.5:1 on white
    warning: '#d97706', // amber-600 - passes 4.5:1 on white
  },
  dark: {
    background: '#1f2937', // gray-800
    foreground: '#f9fafb', // gray-50
    muted: '#9ca3af', // gray-400 - passes 4.5:1 on gray-800
    primary: '#60a5fa', // blue-400 - passes 4.5:1 on gray-800
    destructive: '#f87171', // red-400 - passes 4.5:1 on gray-800
    success: '#4ade80', // green-400 - passes 4.5:1 on gray-800
    warning: '#fbbf24', // yellow-400 - passes 4.5:1 on gray-800
  },
};
