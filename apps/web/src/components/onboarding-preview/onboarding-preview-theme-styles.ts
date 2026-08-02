import type { CSSProperties } from 'react';
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
    '--theme-primary': theme.colors.primary,
    '--theme-secondary': theme.colors.secondary,
    '--theme-accent': theme.colors.accent,
    '--theme-background': theme.colors.background,
    '--theme-foreground': theme.colors.foreground,
    '--theme-muted': theme.colors.muted,
    '--theme-muted-foreground': theme.colors.mutedForeground,
    '--theme-border': theme.colors.border,
    '--theme-header-bg': theme.colors.header.background,
    '--theme-header-text': theme.colors.header.text,
    '--theme-header-icon': theme.colors.header.iconColor,
    '--theme-header-search-border': theme.colors.header.searchBorder,
    '--theme-header-search-bg': theme.colors.header.searchBackground,
    '--theme-footer-bg': theme.colors.footer.background,
    '--theme-footer-text': theme.colors.footer.text,
    '--theme-footer-link': theme.colors.footer.linkColor,
    '--theme-footer-link-hover': theme.colors.footer.linkHoverColor,
    '--theme-button-primary-bg': theme.colors.button.primary.background,
    '--theme-button-primary-text': theme.colors.button.primary.text,
    '--theme-button-primary-hover': theme.colors.button.primary.hover,
    '--theme-button-secondary-bg': theme.colors.button.secondary.background,
    '--theme-button-secondary-text': theme.colors.button.secondary.text,
    '--theme-button-secondary-hover': theme.colors.button.secondary.hover,
    '--theme-button-accent-bg': theme.colors.button.accent.background,
    '--theme-button-accent-text': theme.colors.button.accent.text,
    '--theme-button-accent-hover': theme.colors.button.accent.hover,
    '--theme-card-bg': theme.colors.card.background,
    '--theme-card-border': theme.colors.card.border,
    '--theme-card-text': theme.colors.card.text,
    '--theme-input-bg': theme.colors.input.background,
    '--theme-input-border': theme.colors.input.border,
    '--theme-input-text': theme.colors.input.text,
    '--theme-input-placeholder': theme.colors.input.placeholder,
    '--theme-input-focus-border': theme.colors.input.focusBorder,
    '--store-primary': theme.colors.primary,
    '--store-accent': theme.colors.accent,
    '--store-background': theme.colors.background,
    '--store-primary-text': theme.colors.button.primary.text,
    '--store-accent-text': theme.colors.button.accent.text,
    '--store-background-text': theme.colors.foreground,
  } as CSSProperties;
}
