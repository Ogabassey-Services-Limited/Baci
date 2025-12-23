/**
 * Comprehensive Theme Configuration System
 *
 * This defines ALL visual aspects of the site that can be customized.
 * Components use CSS variables that are set from this configuration.
 */

export interface ThemeConfiguration {
  // ===== COLORS =====
  colors: {
    // Base colors
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    border: string;

    // Component-specific colors
    header: {
      background: string;
      text: string;
      iconColor: string;
      searchBorder: string;
      searchBackground: string;
    };

    footer: {
      background: string;
      text: string;
      linkColor: string;
      linkHoverColor: string;
    };

    button: {
      primary: {
        background: string;
        text: string;
        hover: string;
      };
      secondary: {
        background: string;
        text: string;
        hover: string;
      };
      accent: {
        background: string;
        text: string;
        hover: string;
      };
    };

    card: {
      background: string;
      border: string;
      text: string;
    };

    input: {
      background: string;
      border: string;
      text: string;
      placeholder: string;
      focusBorder: string;
    };
  };

  // ===== TYPOGRAPHY =====
  typography: {
    fontFamily: {
      heading: string;
      body: string;
      mono: string;
    };

    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
      '5xl': string;
      '6xl': string;
    };

    fontWeight: {
      light: number;
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
      extrabold: number;
    };

    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
      loose: number;
    };

    letterSpacing: {
      tight: string;
      normal: string;
      wide: string;
    };
  };

  // ===== SPACING =====
  spacing: {
    // Global spacing scale
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;

    // Component-specific spacing
    header: {
      height: string;
      paddingX: string;
      paddingY: string;
    };

    footer: {
      paddingY: string;
      paddingX: string;
    };

    section: {
      paddingY: string;
      paddingX: string;
    };

    container: {
      maxWidth: string;
      paddingX: string;
    };
  };

  // ===== BORDERS & RADIUS =====
  borders: {
    width: {
      none: string;
      thin: string;
      normal: string;
      thick: string;
    };

    radius: {
      none: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      full: string;
    };

    style: {
      solid: string;
      dashed: string;
      dotted: string;
    };
  };

  // ===== SHADOWS =====
  shadows: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    inner: string;
  };

  // ===== ANIMATIONS =====
  animations: {
    duration: {
      fast: string;
      normal: string;
      slow: string;
    };

    easing: {
      linear: string;
      easeIn: string;
      easeOut: string;
      easeInOut: string;
    };
  };

  // ===== LAYOUT =====
  layout: {
    breakpoints: {
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
    };

    zIndex: {
      dropdown: number;
      sticky: number;
      fixed: number;
      modalBackdrop: number;
      modal: number;
      popover: number;
      tooltip: number;
    };
  };
}

/**
 * Default theme configuration
 * This serves as the base theme that can be customized
 */
export const defaultTheme: ThemeConfiguration = {
  colors: {
    primary: '#3F51B5',
    secondary: '#F5F5F5',
    accent: '#FFC107',
    background: '#FFFFFF',
    foreground: '#000000',
    muted: '#F5F5F5',
    mutedForeground: '#737373',
    border: '#E2E8F0',

    header: {
      background: '#FFFFFF',
      text: '#000000',
      iconColor: '#000000',
      searchBorder: '#E2E8F0',
      searchBackground: '#FFFFFF',
    },

    footer: {
      background: '#1A202C',
      text: '#FFFFFF',
      linkColor: '#FFC107',
      linkHoverColor: '#FFD54F',
    },

    button: {
      primary: {
        background: '#3F51B5',
        text: '#FFFFFF',
        hover: '#303F9F',
      },
      secondary: {
        background: '#F5F5F5',
        text: '#000000',
        hover: '#E0E0E0',
      },
      accent: {
        background: '#FFC107',
        text: '#000000',
        hover: '#FFB300',
      },
    },

    card: {
      background: '#FFFFFF',
      border: '#E2E8F0',
      text: '#000000',
    },

    input: {
      background: '#FFFFFF',
      border: '#E2E8F0',
      text: '#000000',
      placeholder: '#A0AEC0',
      focusBorder: '#3F51B5',
    },
  },

  typography: {
    fontFamily: {
      heading: 'Inter, sans-serif',
      body: 'Inter, sans-serif',
      mono: 'Menlo, Monaco, Courier New, monospace',
    },

    fontSize: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      base: '1rem', // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem', // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem', // 48px
      '6xl': '3.75rem', // 60px
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
      loose: 2,
    },

    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
    },
  },

  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem', // 8px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
    '2xl': '3rem', // 48px
    '3xl': '4rem', // 64px

    header: {
      height: '4rem', // 64px
      paddingX: '1rem', // 16px
      paddingY: '0.5rem', // 8px
    },

    footer: {
      paddingY: '3rem', // 48px
      paddingX: '1rem', // 16px
    },

    section: {
      paddingY: '3rem', // 48px
      paddingX: '1rem', // 16px
    },

    container: {
      maxWidth: '1280px',
      paddingX: '1rem', // 16px
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
      sm: '0.25rem', // 4px
      md: '0.5rem', // 8px
      lg: '0.75rem', // 12px
      xl: '1rem', // 16px
      '2xl': '1.5rem', // 24px
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
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
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
};
