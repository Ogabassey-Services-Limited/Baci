import type { ShippingProviderCode } from './types';

export interface ProviderConfig {
  code: ShippingProviderCode;
  name: string;
  displayName: string;
  enabled: boolean;
  supportsInternational: boolean;
  supportsDomestic: boolean;
}

export const PROVIDER_CONFIGS: Record<ShippingProviderCode, ProviderConfig> = {
  GIGL: {
    code: 'GIGL',
    name: 'GIGL',
    displayName: 'GIG Logistics',
    enabled: true,
    supportsInternational: true,
    supportsDomestic: true,
  },
  TOPSHIP: {
    code: 'TOPSHIP',
    name: 'Topship',
    displayName: 'Topship',
    enabled: true,
    supportsInternational: true,
    supportsDomestic: true,
  },
};

export type DeliveryTier = 'express' | 'standard' | 'economy' | 'premium';

export const TIER_DISPLAY_NAMES: Record<
  DeliveryTier,
  { name: string; icon: string }
> = {
  express: { name: 'Express Delivery', icon: '⚡' },
  standard: { name: 'Standard Delivery', icon: '⭐' },
  economy: { name: 'Economy Delivery', icon: '💰' },
  premium: { name: 'Premium Delivery', icon: '🚀' },
};

export function mapToDeliveryTier(
  serviceTier: string,
  estimatedDays: number
): DeliveryTier {
  const tier = serviceTier.toLowerCase();

  if (
    tier.includes('express') ||
    tier.includes('fast') ||
    tier.includes('priority') ||
    estimatedDays <= 2
  ) {
    return 'express';
  }

  if (
    tier.includes('fedex') ||
    tier.includes('dhl') ||
    tier.includes('ups') ||
    tier.includes('premium')
  ) {
    return 'premium';
  }

  if (
    tier.includes('budget') ||
    tier.includes('economy') ||
    tier.includes('lastmile') ||
    estimatedDays >= 5
  ) {
    return 'economy';
  }

  return 'standard';
}
