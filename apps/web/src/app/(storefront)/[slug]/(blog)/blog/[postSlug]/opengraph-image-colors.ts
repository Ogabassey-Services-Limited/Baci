import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import type { MerchantBlogOgImageData } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-data';

extend([namesPlugin]);

export type BlogOgBrandColors = {
  background: string;
  primary: string;
  accent: string;
};

export function getBlogOgBrandColors(
  data: MerchantBlogOgImageData
): BlogOgBrandColors {
  return {
    background: data.merchantBrandColors.background || '#1a1a2e',
    primary: data.merchantBrandColors.primary || '#3B82F6',
    accent: data.merchantBrandColors.accent || '#F59E0B',
  };
}

export function getBlogOgForegroundColor(
  background: string,
  gradientStops: readonly string[] = []
): string {
  const parsed = colord(background.trim());
  if (!parsed.isValid()) return '#000000';

  const backgroundColor = parsed.toRgb();
  const surfaceLuminances = [
    getRelativeLuminance(
      backgroundColor.r,
      backgroundColor.g,
      backgroundColor.b
    ),
    ...gradientStops.flatMap((stop) => {
      const composited = compositeOverBackground(stop, backgroundColor);
      return composited
        ? [getRelativeLuminance(composited.r, composited.g, composited.b)]
        : [];
    }),
  ];
  const blackContrast = Math.min(
    ...surfaceLuminances.map((luminance) => getContrastRatio(luminance, 0))
  );
  const whiteContrast = Math.min(
    ...surfaceLuminances.map((luminance) => getContrastRatio(luminance, 1))
  );
  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
}

function compositeOverBackground(
  overlay: string,
  background: { r: number; g: number; b: number }
): { r: number; g: number; b: number } | null {
  const parsed = colord(overlay.trim());
  if (!parsed.isValid()) return null;

  const { r, g, b, a } = parsed.toRgb();
  return {
    r: r * a + background.r * (1 - a),
    g: g * a + background.g * (1 - a),
    b: b * a + background.b * (1 - a),
  };
}

function getRelativeLuminance(
  red: number,
  green: number,
  blue: number
): number {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * linearize(red) +
    0.7152 * linearize(green) +
    0.0722 * linearize(blue)
  );
}

function getContrastRatio(firstLuminance: number, secondLuminance: number) {
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function toRgba(color: string, fallback: string, opacity: number) {
  const normalized = color.trim();
  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hexMatch) return fallback;

  const hex = hexMatch[1];
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : hex;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function getTransparentBlogOgBrandColors(colors: BlogOgBrandColors) {
  return {
    primary20: toRgba(colors.primary, 'rgba(59, 130, 246, 0.2)', 0.2),
    primary15: toRgba(colors.primary, 'rgba(59, 130, 246, 0.15)', 0.15),
    primary13: toRgba(colors.primary, 'rgba(59, 130, 246, 0.13)', 0.13),
    accent15: toRgba(colors.accent, 'rgba(245, 158, 11, 0.15)', 0.15),
  };
}
