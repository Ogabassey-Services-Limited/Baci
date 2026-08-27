import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import type { MerchantBlogOgImageData } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-data';
import { getContrastingTextColor } from '@/lib/color-utils';

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

export function getBlogOgForegroundColor(background: string): string {
  const parsed = colord(background.trim());
  if (!parsed.isValid()) return '#000000';

  const normalized = parsed.toHex();
  // The contrast helper accepts opaque hex values. Ignore alpha when a valid
  // CSS color includes one; the configured background is composited by Satori.
  return getContrastingTextColor(
    normalized.length === 9 ? normalized.slice(0, 7) : normalized
  );
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
