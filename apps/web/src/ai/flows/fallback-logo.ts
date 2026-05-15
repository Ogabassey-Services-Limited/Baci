import { Buffer } from 'node:buffer';
import type { BrandColors } from '@/types';

const FALLBACK_LOGO_COLORS: Record<string, BrandColors> = {
  electronics: {
    primary: '#2563EB',
    background: '#EFF6FF',
    accent: '#06B6D4',
  },
  fashion: {
    primary: '#BE123C',
    background: '#FFF1F2',
    accent: '#F59E0B',
  },
  'food-beverage': {
    primary: '#15803D',
    background: '#FFF7ED',
    accent: '#F97316',
  },
  'hair-extensions': {
    primary: '#7C2D12',
    background: '#FFF7ED',
    accent: '#D97706',
  },
  handmade: {
    primary: '#B45309',
    background: '#FFFBEB',
    accent: '#0F766E',
  },
  'health-beauty': {
    primary: '#DB2777',
    background: '#FDF2F8',
    accent: '#14B8A6',
  },
  'home-goods': {
    primary: '#92400E',
    background: '#FEF3C7',
    accent: '#4D7C0F',
  },
  pharmaceuticals: {
    primary: '#0F766E',
    background: '#ECFDF5',
    accent: '#2563EB',
  },
};

function escapeSvgText(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return replacements[character];
  });
}

export function createFallbackLogo(
  businessName: string,
  businessType: string
): { logoDataUri: string; brandColors: BrandColors } {
  const brandColors =
    FALLBACK_LOGO_COLORS[businessType] ?? FALLBACK_LOGO_COLORS.fashion;
  const displayName = businessName || 'Baci Store';
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'B';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="${escapeSvgText(displayName)} logo"><rect width="512" height="512" rx="112" fill="${brandColors.background}"/><circle cx="256" cy="228" r="128" fill="${brandColors.primary}"/><text x="256" y="276" text-anchor="middle" font-family="Arial, sans-serif" font-size="118" font-weight="800" fill="#FFFFFF">${escapeSvgText(initials)}</text><rect x="128" y="382" width="256" height="24" rx="12" fill="${brandColors.accent}"/></svg>`;

  return {
    logoDataUri: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    brandColors,
  };
}
