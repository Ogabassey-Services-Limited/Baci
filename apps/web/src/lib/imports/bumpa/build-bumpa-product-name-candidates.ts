import { createBumpaProductProfile } from '@/lib/imports/bumpa/bumpa-product-normalization';

export function buildBumpaProductNameCandidates(itemName: string) {
  const profile = createBumpaProductProfile(itemName);
  const candidates = [
    profile.rawProductName,
    profile.originalBrandProductName,
    profile.normalizedProductName,
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}
