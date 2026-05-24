import Ionicons, { type IoniconsIconName } from "@react-native-vector-icons/ionicons/static";

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

const ICON_MAP: Record<string, IoniconsIconName> = {
  fashion: 'shirt-outline',
  electronics: 'laptop-outline',
  'home-goods': 'home-outline',
  'health-beauty': 'sparkles-outline',
  handmade: 'color-palette-outline',
  'food-beverage': 'cafe-outline',
  'hair-extensions': 'cut-outline',
  pharmaceuticals: 'medical-outline',
  general: 'cube-outline',
  // Utility Panel specifics
  airtime: 'call-outline',
  data: 'wifi-outline',
  tv: 'tv-outline',
  power: 'flash-outline',
  gaming: 'game-controller-outline',
};

/**
 * Get the corresponding mobile icon for a business type or category slug
 */
export function getCategoryIcon(
  identifier: string
): IoniconsIconName {
  const normalized = identifier.toLowerCase();
  return ICON_MAP[normalized] || ICON_MAP.general;
}
