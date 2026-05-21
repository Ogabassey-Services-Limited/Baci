import type { PurchasesPackage } from 'react-native-purchases';

export const DEFAULT_CLOSE_TOP = 30;
export const DEFAULT_HEADER_PADDING = 50;
// Extra top spacing (dp) above safe-area inset to avoid close button overlap.
export const SAFE_AREA_CLOSE_OFFSET = 11;
// Extra bottom spacing (dp) above safe-area inset to keep footer clear of system UI.
export const SAFE_AREA_FOOTER_OFFSET = 6;
// Extra top spacing (dp) above safe-area inset to keep header clear of system UI.
export const SAFE_AREA_HEADER_OFFSET = 26;

export interface ProFeature {
  desc: string;
  id: string;
  title: string;
}

export const PRO_FEATURES: ProFeature[] = [
  {
    id: '1',
    title: 'Unlimited Storefronts',
    desc: 'Build as many shops as you need',
  },
  {
    id: '2',
    title: 'Advanced AI Analytics',
    desc: 'Predict trends and customer behavior',
  },
  {
    id: '3',
    title: 'Premium Themes',
    desc: 'Unlock all 2026 designer storefronts',
  },
  {
    id: '4',
    title: 'Custom Domains',
    desc: 'Use your own .com or .shop domain',
  },
  {
    id: '5',
    title: 'Priority Support',
    desc: '24/7 dedicated help from our team',
  },
];

export function getDefaultPackage(
  packages: PurchasesPackage[] | null | undefined
): PurchasesPackage | null {
  if (!packages || packages.length === 0) return null;

  const annual = packages.find((pack) => pack.packageType === 'ANNUAL');
  const monthly = packages.find((pack) => pack.packageType === 'MONTHLY');
  return annual ?? monthly ?? packages[0] ?? null;
}
