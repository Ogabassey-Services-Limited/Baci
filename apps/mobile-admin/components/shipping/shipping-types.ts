import type { Ionicons } from '@expo/vector-icons';

export const AVAILABLE_PROVIDERS = [
  {
    id: 'gigl',
    name: 'GIG Logistics',
    description: 'Nationwide delivery with tracking',
    icon: 'cube-outline',
  },
  {
    id: 'topship',
    name: 'Topship',
    description: 'Fast local and international shipping',
    icon: 'airplane-outline',
  },
  {
    id: 'shiip',
    name: 'Shiip',
    description: 'Same-day and next-day delivery',
    icon: 'flash-outline',
  },
] as const satisfies readonly {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[];

export type ProviderId = (typeof AVAILABLE_PROVIDERS)[number]['id'];
export type ShippingProvider = (typeof AVAILABLE_PROVIDERS)[number];

export interface ShippingSettings {
  merchant_id: string;
  shipping_providers: ProviderId[];
  free_shipping_threshold: number | null;
}
