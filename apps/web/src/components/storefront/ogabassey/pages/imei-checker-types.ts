import type { ServiceTier } from './imei-checker-tiers';

export interface ImeiRequestIdentity {
  imei: string;
  tier: ServiceTier;
  key: string;
}

export interface ImeiResult {
  imei: string;
  device: string;
  modelNumber: string;
  status: 'Clean' | 'Blacklisted' | 'Unknown';
  icloud: string;
  icloudLock: string;
  simLock: string;
  blacklistStatus: string;
  carrier: string;
  deviceImage: string;
  score: number;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCountry?: string;
  warranty?: string;
  refurbished?: string;
  demoUnit?: string;
  deviceType: 'apple' | 'android' | 'other';
  verdict: string;
  verdictType: 'safe' | 'caution' | 'danger';
}

export interface ProductSuggestion {
  id: string;
  name: string;
  category?: string;
  image?: string;
}

export type { ServiceTier } from './imei-checker-tiers';
