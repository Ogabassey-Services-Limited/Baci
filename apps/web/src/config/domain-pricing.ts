/**
 * Go54 Domain Pricing Configuration
 * Prices in Nigerian Naira (NGN)
 *
 * Source: https://www.whogohost.com/host/domain/pricing
 * Last updated: 2025-11-22
 */

export interface DomainPricing {
  tld: string;
  registration: number;
  renewal: number;
  transfer: number;
  gracePeriod: number; // days
  redemptionPeriod: number; // days
  redemptionFee?: number;
  popular?: boolean;
  recommended?: boolean;
  category: 'nigerian' | 'global' | 'premium';
}

export const DOMAIN_PRICING: DomainPricing[] = [
  // Nigerian Domains (Most Recommended for local businesses)
  {
    tld: '.com.ng',
    registration: 5999,
    renewal: 7200,
    transfer: 7200,
    gracePeriod: 0,
    redemptionPeriod: 28,
    redemptionFee: 1500,
    popular: true,
    recommended: true,
    category: 'nigerian',
  },
  {
    tld: '.ng',
    registration: 15600,
    renewal: 15600,
    transfer: 15600,
    gracePeriod: 0,
    redemptionPeriod: 28,
    redemptionFee: 1500,
    category: 'nigerian',
  },
  {
    tld: '.org.ng',
    registration: 7200,
    renewal: 7200,
    transfer: 7200,
    gracePeriod: 0,
    redemptionPeriod: 28,
    redemptionFee: 1500,
    category: 'nigerian',
  },
  {
    tld: '.net.ng',
    registration: 7200,
    renewal: 7200,
    transfer: 7200,
    gracePeriod: 0,
    redemptionPeriod: 28,
    redemptionFee: 1500,
    category: 'nigerian',
  },
  {
    tld: '.edu.ng',
    registration: 15600,
    renewal: 15600,
    transfer: 15600,
    gracePeriod: 0,
    redemptionPeriod: 28,
    redemptionFee: 1500,
    category: 'nigerian',
  },
  {
    tld: '.name.ng',
    registration: 500,
    renewal: 500,
    transfer: 500,
    gracePeriod: 0,
    redemptionPeriod: 28,
    redemptionFee: 1500,
    popular: true,
    category: 'nigerian',
  },

  // Global Domains
  {
    tld: '.com',
    registration: 14999,
    renewal: 24000,
    transfer: 24000,
    gracePeriod: 45,
    redemptionPeriod: 30,
    popular: true,
    recommended: true,
    category: 'global',
  },
  {
    tld: '.org',
    registration: 14000,
    renewal: 25000,
    transfer: 25000,
    gracePeriod: 45,
    redemptionPeriod: 30,
    category: 'global',
  },
  {
    tld: '.net',
    registration: 29000,
    renewal: 29000,
    transfer: 29000,
    gracePeriod: 45,
    redemptionPeriod: 30,
    category: 'global',
  },
  {
    tld: '.info',
    registration: 16200,
    renewal: 16200,
    transfer: 16200,
    gracePeriod: 45,
    redemptionPeriod: 30,
    category: 'global',
  },
  {
    tld: '.biz',
    registration: 18000,
    renewal: 18000,
    transfer: 18000,
    gracePeriod: 45,
    redemptionPeriod: 30,
    category: 'global',
  },

  // Premium Domains
  {
    tld: '.store',
    registration: 50000,
    renewal: 50000,
    transfer: 50000,
    gracePeriod: 45,
    redemptionPeriod: 30,
    recommended: true,
    category: 'premium',
  },
];

// Resale pricing with markup (40% Nigerian, 30% Global, 20% Premium)
export const RESALE_MARKUP = {
  nigerian: 1.4, // 40% markup
  global: 1.3, // 30% markup
  premium: 1.2, // 20% markup
};

export function getResalePrice(
  cost: number,
  category: DomainPricing['category']
): number {
  return Math.ceil(cost * RESALE_MARKUP[category]);
}

export function getDomainPricing(tld: string): DomainPricing | undefined {
  return DOMAIN_PRICING.find((p) => p.tld === tld);
}

export function getPopularDomains(): DomainPricing[] {
  return DOMAIN_PRICING.filter((p) => p.popular);
}

export function getRecommendedDomains(): DomainPricing[] {
  return DOMAIN_PRICING.filter((p) => p.recommended);
}

export function getNigerianDomains(): DomainPricing[] {
  return DOMAIN_PRICING.filter((p) => p.category === 'nigerian');
}

export function getAllTLDs(): string[] {
  return DOMAIN_PRICING.map((p) => p.tld);
}

export function calculateDomainPrice(tld: string, years: number = 1) {
  const pricing = getDomainPricing(tld);
  if (!pricing) return null;

  const costPrice = pricing.registration + pricing.renewal * (years - 1);
  const sellPrice =
    getResalePrice(pricing.registration, pricing.category) +
    getResalePrice(pricing.renewal, pricing.category) * (years - 1);
  const profit = sellPrice - costPrice;

  return {
    tld,
    years,
    costPrice,
    sellPrice,
    profit,
    category: pricing.category,
  };
}
