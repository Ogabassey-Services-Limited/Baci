import { describe, expect, it } from 'vitest';
import type { PurchasesPackage } from 'react-native-purchases';
import { PRO_FEATURES, getDefaultPackage } from './paywall.constants';

const MONTHLY_PACKAGE_TYPE = 'MONTHLY' as PurchasesPackage['packageType'];
const ANNUAL_PACKAGE_TYPE = 'ANNUAL' as PurchasesPackage['packageType'];
const WEEKLY_PACKAGE_TYPE = 'WEEKLY' as PurchasesPackage['packageType'];

function createPackage(
  identifier: string,
  packageType: PurchasesPackage['packageType']
): PurchasesPackage {
  return {
    identifier,
    packageType,
    product: {
      price: 9.99,
      priceString: '$9.99',
      title: identifier,
    },
  } as PurchasesPackage;
}

describe('paywall.constants', () => {
  it('keeps a stable pro feature list', () => {
    expect(PRO_FEATURES).toHaveLength(5);
    expect(PRO_FEATURES[0]?.title).toBe('Unlimited Storefronts');
    expect(PRO_FEATURES.at(-1)?.title).toBe('Priority Support');
  });

  it('prefers annual packages when choosing defaults', () => {
    const monthly = createPackage('monthly', MONTHLY_PACKAGE_TYPE);
    const annual = createPackage('annual', ANNUAL_PACKAGE_TYPE);

    expect(getDefaultPackage([monthly, annual])).toBe(annual);
  });

  it('falls back to monthly then first package when annual is absent', () => {
    const monthly = createPackage('monthly', MONTHLY_PACKAGE_TYPE);
    const weekly = createPackage('weekly', WEEKLY_PACKAGE_TYPE);

    expect(getDefaultPackage([monthly, weekly])).toBe(monthly);
    expect(getDefaultPackage([weekly])).toBe(weekly);
    expect(getDefaultPackage([])).toBeNull();
    expect(getDefaultPackage(null)).toBeNull();
    expect(getDefaultPackage(undefined)).toBeNull();
  });
});
