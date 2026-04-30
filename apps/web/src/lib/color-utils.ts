/**
 * Color utility functions for accessibility and theming
 */

/**
 * Calculate relative luminance of a color (WCAG formula)
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Relative luminance (0-1)
 */
function getLuminance(r: number, g: number, b: number): number {
  // Convert to 0-1 range
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });

  // Calculate luminance using WCAG formula
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Convert hex color to RGB values
 * @param hex - Hex color string (e.g., "#FF0000" or "FF0000")
 * @returns RGB object with r, g, b values
 */
export function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Handle 3-digit hex
  if (cleanHex.length === 3) {
    const [r, g, b] = cleanHex
      .split('')
      .map((char) => Number.parseInt(char + char, 16));
    return { r, g, b };
  }

  // Handle 6-digit hex
  if (cleanHex.length === 6) {
    const r = Number.parseInt(cleanHex.substring(0, 2), 16);
    const g = Number.parseInt(cleanHex.substring(2, 4), 16);
    const b = Number.parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }

  return null;
}

/**
 * Convert a hex color to rgba() with a clamped alpha channel.
 * @param hex - Hex color string
 * @param alpha - Opacity value, clamped to 0-1
 * @returns CSS rgba() string, or the original value when parsing fails
 */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }

  const finiteAlpha = Number.isFinite(alpha) ? alpha : 1;
  const clampedAlpha = Math.max(0, Math.min(1, finiteAlpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedAlpha})`;
}

/**
 * Find the darkest color from a list of hex colors.
 * @param colors - An array of hex color strings.
 * @returns The darkest hex color string from the array.
 */
export function findDarkestColor(colors: string[]): string {
  let darkestColor = colors[0];
  let minLuminance = 1;

  for (const color of colors) {
    const rgb = hexToRgb(color);
    if (rgb) {
      const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
      if (luminance < minLuminance) {
        minLuminance = luminance;
        darkestColor = color;
      }
    }
  }
  return darkestColor;
}

/**
 * Calculate contrast ratio between two colors (WCAG formula)
 * @param color1 - First color in hex format
 * @param color2 - Second color in hex format
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 1;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine if a color is "light" (needs dark text) or "dark" (needs light text)
 * @param hexColor - Hex color string
 * @returns true if the color is light (use dark text), false if dark (use light text)
 */
export function isLightColor(hexColor: string): boolean {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return false;

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

  // Threshold of 0.5 works well for most cases
  // Colors with luminance > 0.5 are considered "light"
  return luminance > 0.5;
}

/**
 * Get contrasting text color (black or white) for a given background color
 * @param bgColor - Background color in hex format
 * @returns "#000000" or "#FFFFFF" depending on which has better contrast
 */
export function getContrastingTextColor(bgColor: string): string {
  if (!bgColor) return '#000000';
  const rgb = hexToRgb(bgColor);
  if (!rgb) return '#000000'; // Default to black for invalid colors

  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  const hsp = Math.sqrt(
    0.299 * (rgb.r * rgb.r) + 0.587 * (rgb.g * rgb.g) + 0.114 * (rgb.b * rgb.b)
  );

  // Using the HSP value, determine whether the color is light or dark
  if (hsp > 127.5) {
    return '#000000'; // Light color, use black text
  } else {
    return '#FFFFFF'; // Dark color, use white text
  }
}

/**
 * Check if a color combination meets WCAG AA standards for normal text (4.5:1)
 * @param bgColor - Background color in hex format
 * @param textColor - Text color in hex format
 * @returns true if contrast ratio is >= 4.5
 */
export function meetsWCAGAA(bgColor: string, textColor: string): boolean {
  return getContrastRatio(bgColor, textColor) >= 4.5;
}

/**
 * Check if a color combination meets WCAG AAA standards for normal text (7:1)
 * @param bgColor - Background color in hex format
 * @param textColor - Text color in hex format
 * @returns true if contrast ratio is >= 7
 */
export function meetsWCAGAAA(bgColor: string, textColor: string): boolean {
  return getContrastRatio(bgColor, textColor) >= 7;
}

/**
 * Check if a color combination meets WCAG AA standards for large text (3:1)
 * @param bgColor - Background color in hex format
 * @param textColor - Text color in hex format
 * @returns true if contrast ratio is >= 3
 */
export function meetsWCAGAALarge(bgColor: string, textColor: string): boolean {
  return getContrastRatio(bgColor, textColor) >= 3;
}

/**
 * Generate a darker or lighter shade of a color for better contrast
 * @param hexColor - Original color in hex format
 * @param amount - Amount to darken (negative) or lighten (positive), range -1 to 1
 * @returns New hex color
 */
export function adjustColorBrightness(
  hexColor: string,
  amount: number
): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;

  const adjust = (value: number) => {
    const adjusted = Math.round(value + 255 * amount);
    return Math.max(0, Math.min(255, adjusted));
  };

  const r = adjust(rgb.r);
  const g = adjust(rgb.g);
  const b = adjust(rgb.b);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
/**
 * Convert hex color to HSL components (H S% L%) as a string for shadcn/ui variables
 * @param hex - Hex color string
 * @returns String in format "H S% L%" (e.g., "239 45% 30%")
 */
export function hexToHslComponents(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '0 0% 0%';

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return `${hDeg} ${sPct}% ${lPct}%`;
}
