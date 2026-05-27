import type { ThemeConfiguration } from '@/lib/theme-config';

type BrandColors = {
  primary: string;
  background: string;
  accent: string;
};

export function deriveThemeFromColors(
  brandColors: BrandColors
): ThemeConfiguration {
  const contrast = (color: string) =>
    color === '#FFFFFF' || color.toLowerCase() === '#fff'
      ? '#000000'
      : '#FFFFFF';
  const primaryText = contrast(brandColors.primary);
  const accentText = contrast(brandColors.accent);

  return {
    colors: {
      primary: brandColors.primary,
      secondary: brandColors.primary,
      accent: brandColors.accent,
      background: brandColors.background,
      foreground: '#000000',
      muted: '#F5F5F5',
      mutedForeground: '#666666',
      border: '#E0E0E0',
      header: {
        background: brandColors.background,
        text: '#000000',
        iconColor: brandColors.primary,
        searchBorder: brandColors.primary,
        searchBackground: '#FFFFFF',
      },
      footer: {
        background: brandColors.primary,
        text: primaryText,
        linkColor: primaryText,
        linkHoverColor: brandColors.accent,
      },
      button: {
        primary: {
          background: brandColors.primary,
          text: primaryText,
          hover: brandColors.primary,
        },
        secondary: {
          background: '#F5F5F5',
          text: '#000000',
          hover: '#E0E0E0',
        },
        accent: {
          background: brandColors.accent,
          text: accentText,
          hover: brandColors.accent,
        },
      },
      card: {
        background: '#FFFFFF',
        border: '#E0E0E0',
        text: '#000000',
      },
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
      xs: '0.5rem',
      sm: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      '3xl': '4rem',
      header: { height: '4rem', paddingX: '1rem', paddingY: '0.5rem' },
      footer: { paddingY: '2rem', paddingX: '1rem' },
      section: { paddingY: '4rem', paddingX: '1rem' },
      container: { maxWidth: '1280px', paddingX: '1rem' },
    },
    borders: {
      width: { none: '0', thin: '1px', normal: '2px', thick: '4px' },
      radius: {
        none: '0',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
      style: { solid: 'solid', dashed: 'dashed', dotted: 'dotted' },
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
      duration: { fast: '150ms', normal: '300ms', slow: '500ms' },
      easing: {
        linear: 'linear',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  };
}
