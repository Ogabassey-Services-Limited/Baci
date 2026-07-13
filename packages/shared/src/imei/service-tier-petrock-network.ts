import type { ImeiServiceTierDefinition } from './service-tier-types';

export const PETROCK_NETWORK_IMEI_SERVICE_TIERS = {
  attFinance: carrierTier('AT&T Finance Status', 'AT&T', 1500, 0.085),
  tmobileFinance: carrierTier(
    'T-Mobile Finance Status',
    'T-Mobile',
    700,
    0.037
  ),
  verizonFinance: carrierTier('Verizon Finance Status', 'Verizon', 700, 0.04),
  tracfoneFinance: carrierTier('TracFone Status', 'TracFone', 700, 0.04),
  xfinityFinance: carrierTier(
    'Xfinity Mobile Status',
    'Xfinity Mobile',
    700,
    0.04
  ),
  japanDocomo: japanTier('NTT Docomo Status', 'NTT Docomo'),
  japanSoftbank: japanTier('SoftBank Status', 'SoftBank'),
  japanKddi: japanTier('KDDI / au Status', 'KDDI / au'),
  japanRakuten: japanTier('Rakuten Mobile Status', 'Rakuten Mobile'),
  japanNetwork: japanTier('Japan Network Status', 'Japanese networks'),
} as const satisfies Record<string, ImeiServiceTierDefinition>;

function carrierTier(
  name: string,
  carrier: string,
  price: number,
  costUsd: number
): ImeiServiceTierDefinition {
  return {
    providerServiceId: 'petrock-only',
    name,
    tagline: `${carrier} eligibility and finance`,
    description: `Check ${carrier} finance and network eligibility status`,
    detail:
      'Returns carrier-specific finance, blacklist and eligibility information when available.',
    price,
    costUsd,
    features: [`${carrier} Status`, 'Finance Status', 'Blacklist Risk'],
    checksIncluded: [
      'device',
      'modelNumber',
      'blacklistStatus',
      'carrier',
      'financeStatus',
    ],
    icon: 'cash-outline',
    brandScopes: ['all'],
    deviceCategories: ['smartphone'],
    identifier: 'imei',
  };
}

function japanTier(name: string, carrier: string): ImeiServiceTierDefinition {
  return {
    providerServiceId: 'petrock-only',
    name,
    tagline: `${carrier} network eligibility`,
    description: `Check ${carrier} network and finance status`,
    detail:
      'Returns the available Japanese network restriction and finance status.',
    price: 1500,
    costUsd: 0.09,
    features: [`${carrier} Status`, 'Finance Status', 'Network Restriction'],
    checksIncluded: ['device', 'modelNumber', 'carrier', 'financeStatus'],
    icon: 'globe-outline',
    brandScopes: ['apple'],
    deviceCategories: ['smartphone'],
    identifier: 'imei',
  };
}
