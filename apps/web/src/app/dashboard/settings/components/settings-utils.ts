import ColorThief from 'colorthief';
import z from 'zod';
import { sanitizeText } from '@/lib/sanitize-core';
import type { BrandColors } from '@/types';

export const settingsSchema = z.object({
  business_name: z
    .string()
    .min(2, 'Business name must be at least 2 characters.'),
  country: z.string().min(2, 'Please select a country.'),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

export const extractColorsFromImage = (
  imageDataUri: string
): Promise<BrandColors> => {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.crossOrigin = 'Anonymous';
    img.src = imageDataUri;

    img.onload = () => {
      try {
        const colorThief = new ColorThief();
        const palette = colorThief.getPalette(img, 5);
        const safePalette = palette ?? [
          [0, 0, 0],
          [0, 0, 0],
        ];

        const toHex = (rgb: number[]) =>
          `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

        const primaryRgb = safePalette[0] || [0, 0, 0];
        const accentRgb = safePalette[1] || primaryRgb;

        resolve({
          primary: toHex(primaryRgb),
          background: '#FFFFFF',
          accent: toHex(accentRgb),
        });
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => {
      reject(new Error('Image could not be loaded for color extraction.'));
    };
  });
};

export const sanitizeSocialMedia = (social: Record<string, string>) => {
  return Object.fromEntries(
    Object.entries(social).map(([key, value]) => [
      key,
      sanitizeText(value.trim()),
    ])
  );
};
