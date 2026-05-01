'use client';

import { useEffect } from 'react';
import { useMerchant } from '@/hooks/use-merchant';
import { getContrastingTextColor, hexToRgba } from '@/lib/color-utils';

const STORE_BORDER_ALPHA = 0.24;

function hexToHsl(hexInput: string): string {
  // Remove hash if present
  let hex = hexInput.replace(/^#/, '');

  // Handle shorthand hex
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  // Parse r, g, b
  let r = Number.parseInt(hex.substring(0, 2), 16);
  let g = Number.parseInt(hex.substring(2, 4), 16);
  let b = Number.parseInt(hex.substring(4, 6), 16);

  // Convert to fraction
  r /= 255;
  g /= 255;
  b /= 255;

  // Find min and max
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

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

  // Convert to degrees and percentages
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}

export function CheckoutThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { merchant } = useMerchant();
  const primaryColor = merchant?.brand_colors?.primary;

  useEffect(() => {
    if (primaryColor) {
      const root = document.documentElement;
      const themeProperties = [
        '--primary',
        '--theme-primary',
        '--store-primary',
        '--store-primary-text',
        '--store-on-primary',
        '--store-border',
      ];
      const previousValues = new Map(
        themeProperties.map((property) => [
          property,
          root.style.getPropertyValue(property),
        ])
      );
      const primaryHex = primaryColor;
      const primaryHsl = hexToHsl(primaryHex);

      // Set Tailwind CSS variable (HSL)
      root.style.setProperty('--primary', primaryHsl);

      // Set Theme variable (Hex) - for components using --theme-primary
      root.style.setProperty('--theme-primary', primaryHex);

      // Set Store variables - for ThemedButton
      root.style.setProperty('--store-primary', primaryHex);

      const textColor = getContrastingTextColor(primaryHex);
      root.style.setProperty('--store-primary-text', textColor);
      root.style.setProperty('--store-on-primary', textColor);
      root.style.setProperty(
        '--store-border',
        hexToRgba(primaryHex, STORE_BORDER_ALPHA)
      );

      return () => {
        for (const [property, previousValue] of previousValues) {
          if (previousValue) {
            root.style.setProperty(property, previousValue);
          } else {
            root.style.removeProperty(property);
          }
        }
      };
    }
  }, [primaryColor]);

  return <>{children}</>;
}
