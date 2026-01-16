/**
 * Icon Bridge - Elite 2025 Edition
 * Maps Baci Web icons (Lucide/Iconoir) to Mobile equivalents (Ionicons)
 */

import type { Ionicons } from '@expo/vector-icons';

export type WebIconName =
  | 'Shirt'
  | 'Laptop'
  | 'Home'
  | 'Sparks'
  | 'Palette'
  | 'CoffeeCup'
  | 'Scissor'
  | 'Pill'
  | 'Sparkles';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  fashion: 'shirt-outline',
  electronics: 'laptop-outline',
  'home-goods': 'home-outline',
  'health-beauty': 'sparkles-outline',
  handmade: 'color-palette-outline',
  'food-beverage': 'cafe-outline',
  'hair-extensions': 'cut-outline',
  pharmaceuticals: 'medical-outline',
  general: 'cube-outline',
};

/**
 * Get the corresponding mobile icon for a business type or category slug
 */
export function getCategoryIcon(
  identifier: string
): keyof typeof Ionicons.glyphMap {
  const normalized = identifier.toLowerCase();
  return ICON_MAP[normalized] || ICON_MAP.general;
}
