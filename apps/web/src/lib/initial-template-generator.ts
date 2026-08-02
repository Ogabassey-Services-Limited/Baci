import type { Data } from '@puckeditor/core';
import { generateFeatures } from '@/lib/storefront-defaults/build-curated-features';
import { generateHeroSlides } from '@/lib/storefront-defaults/build-curated-hero';
import { buildCuratedStorefront } from '@/lib/storefront-defaults/build-curated-storefront';
import type { GenerateInitialTemplateParams } from '@/lib/storefront-defaults/curated-storefront-types';
import { generateLegacyAiCuratedContent } from '@/lib/storefront-defaults/legacy-ai-curated-content';
import type { ThemeConfiguration } from '@/lib/theme-config';
import type { BrandColors } from '@/types';

/**
 * Derive a complete theme configuration from brand colors
 */
export function deriveThemeFromColors(
  brandColors: BrandColors
): ThemeConfiguration {
  // Helper to get contrasting text color (simplified)
  const getContrastColor = (bgColor: string): string => {
    // Simple heuristic - in production, use proper color contrast calculation
    return bgColor === '#FFFFFF' || bgColor.toLowerCase() === '#fff'
      ? '#000000'
      : '#FFFFFF';
  };

  // Helper to darken color (simplified)
  const darken = (color: string, _percent: number = 10): string => {
    // Simplified - in production, use proper color manipulation library
    return color;
  };

  // Helper to lighten color (simplified)
  const _lighten = (color: string, _percent: number = 10): string => {
    // Simplified - in production, use proper color manipulation library
    return color;
  };

  const primaryText = getContrastColor(brandColors.primary);
  const accentText = getContrastColor(brandColors.accent);

  return {
    colors: {
      // Base colors
      primary: brandColors.primary,
      secondary: brandColors.secondary ?? darken(brandColors.primary, 20),
      accent: brandColors.accent,
      background: brandColors.background,
      foreground: '#000000',
      muted: '#F5F5F5',
      mutedForeground: '#666666',
      border: '#E0E0E0',

      // Header colors
      header: {
        background: brandColors.background,
        text: '#000000',
        iconColor: brandColors.primary,
        searchBorder: brandColors.primary,
        searchBackground: '#FFFFFF',
      },

      // Footer colors
      footer: {
        background: brandColors.primary,
        text: primaryText,
        linkColor: primaryText,
        linkHoverColor: brandColors.accent,
      },

      // Button colors
      button: {
        primary: {
          background: brandColors.primary,
          text: primaryText,
          hover: darken(brandColors.primary, 10),
        },
        secondary: {
          background: '#F5F5F5',
          text: '#000000',
          hover: '#E0E0E0',
        },
        accent: {
          background: brandColors.accent,
          text: accentText,
          hover: darken(brandColors.accent, 10),
        },
      },

      // Card colors
      card: {
        background: '#FFFFFF',
        border: '#E0E0E0',
        text: '#000000',
      },

      // Input colors
      input: {
        background: '#FFFFFF',
        border: '#E0E0E0',
        text: '#000000',
        placeholder: '#999999',
        focusBorder: brandColors.primary,
      },
    },

    typography: {
      fontFamily: {
        heading: 'Inter, sans-serif',
        body: 'Inter, sans-serif',
        mono: 'monospace',
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
      },
      fontWeight: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
      },
      lineHeight: {
        tight: 1.25,
        normal: 1.5,
        relaxed: 1.75,
        loose: 2.0,
      },
      letterSpacing: {
        tight: '-0.025em',
        normal: '0',
        wide: '0.025em',
      },
    },

    spacing: {
      // Global spacing scale
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      '3xl': '4rem',

      // Component-specific spacing
      header: {
        height: '4rem',
        paddingX: '1rem',
        paddingY: '0.5rem',
      },
      footer: {
        paddingY: '2rem',
        paddingX: '1rem',
      },
      section: {
        paddingY: '4rem',
        paddingX: '1rem',
      },
      container: {
        maxWidth: '1280px',
        paddingX: '1rem',
      },
    },

    borders: {
      width: {
        none: '0',
        thin: '1px',
        normal: '2px',
        thick: '4px',
      },
      radius: {
        none: '0',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
      style: {
        solid: 'solid',
        dashed: 'dashed',
        dotted: 'dotted',
      },
    },

    shadows: {
      none: 'none',
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    },

    layout: {
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      zIndex: {
        dropdown: 1000,
        sticky: 1020,
        fixed: 1030,
        modalBackdrop: 1040,
        modal: 1050,
        popover: 1060,
        tooltip: 1070,
      },
    },

    animations: {
      duration: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
      },
      easing: {
        linear: 'linear',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  };
}

export { generateFeatures, generateHeroSlides };

export async function generateInitialTemplate(
  params: GenerateInitialTemplateParams
): Promise<Data> {
  const theme = deriveThemeFromColors(params.brandColors);
  const aiContent = await generateLegacyAiCuratedContent(
    params.businessName,
    params.businessType
  );
  return buildCuratedStorefront(params, theme, aiContent);
}
