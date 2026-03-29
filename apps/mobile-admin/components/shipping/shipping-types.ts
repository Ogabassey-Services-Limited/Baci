import type { Ionicons } from '@expo/vector-icons';

export interface ShippingSettings {
  merchant_id: string;
  shipping_providers: string[];
  free_shipping_threshold: number | null;
}

export interface ShippingProvider {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}
