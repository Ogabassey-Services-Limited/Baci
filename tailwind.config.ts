import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/templates/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        none: 'var(--theme-radius-none)',
        sm: 'var(--theme-radius-sm)',
        DEFAULT: 'var(--theme-radius-md)',
        lg: 'var(--theme-radius-lg)',
        xl: 'var(--theme-radius-xl)',
        '2xl': 'var(--theme-radius-2xl)',
        full: 'var(--theme-radius-full)',
      },
      spacing: {
        xs: 'var(--theme-space-xs)',
        sm: 'var(--theme-space-sm)',
        md: 'var(--theme-space-md)',
        lg: 'var(--theme-space-lg)',
        xl: 'var(--theme-space-xl)',
        '2xl': 'var(--theme-space-2xl)',
        '3xl': 'var(--theme-space-3xl)',
      },
      boxShadow: {
        none: 'var(--theme-shadow-none)',
        sm: 'var(--theme-shadow-sm)',
        DEFAULT: 'var(--theme-shadow-md)',
        lg: 'var(--theme-shadow-lg)',
        xl: 'var(--theme-shadow-xl)',
        '2xl': 'var(--theme-shadow-2xl)',
        inner: 'var(--theme-shadow-inner)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
