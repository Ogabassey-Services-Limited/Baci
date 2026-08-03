import type { CSSProperties } from 'react';
import { getCuratedThemeTokenProjection } from '@/lib/storefront-defaults/curated-theme-token-projection';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import type { BrandColors } from '@/types';

export function getOnboardingPreviewThemeStyles(
  brandColors: BrandColors,
  businessType: string
): CSSProperties {
  const theme = deriveCuratedTheme(brandColors, businessType);
  return {
    backgroundColor: 'var(--theme-background)',
    color: 'var(--theme-foreground)',
    ...getCuratedThemeTokenProjection(theme),
  } as CSSProperties;
}
