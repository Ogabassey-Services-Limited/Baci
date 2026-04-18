import type { MerchantData } from '@/hooks/merchant';
import { resolveGmcPrimaryImage } from '@/lib/gmc-feed-images';
import type { MerchantTrustProfile } from './merchant-trust-profile-types';

export interface MerchantCenterReadinessCheck {
  id:
    | 'support-contact'
    | 'social-profiles'
    | 'legal-identity'
    | 'return-policy'
    | 'shipping-policy'
    | 'brand-coverage'
    | 'image-coverage'
    | 'identifier-coverage'
    | 'google-category-coverage';
  label: string;
  severity: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface MerchantCenterReadiness {
  checks: MerchantCenterReadinessCheck[];
  totals: {
    products: number;
    withBrand: number;
    withIdentifier: number;
    withGoogleCategory: number;
    withVerifiedImage: number;
  };
}

interface ReadinessFeedProduct {
  id: string;
  brand?: string;
  gtin?: string;
  mpn?: string;
  google_product_category?: string;
  category?: string;
  category_slug?: string;
  categories?: { name?: string; slug?: string } | null;
}

interface ReadinessFeedData {
  products: ReadinessFeedProduct[];
  imageManifest: Record<string, Parameters<typeof resolveGmcPrimaryImage>[0]>;
}

interface BuildGoogleMerchantReadinessInput {
  merchant: MerchantData;
  trustProfile: MerchantTrustProfile;
  feedData: ReadinessFeedData;
}

function isPresent(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function isAnyPresent(values: Array<string | null | undefined>): boolean {
  return values.some((value) => isPresent(value));
}

function coverageSeverity(
  covered: number,
  total: number,
  zeroCoverageSeverity: 'warn' | 'fail' = 'warn'
): 'pass' | 'warn' | 'fail' {
  if (total === 0) {
    return 'warn';
  }

  if (covered === 0) {
    return zeroCoverageSeverity;
  }

  return covered === total ? 'pass' : 'warn';
}

function buildCoverageMessage(
  label: string,
  covered: number,
  total: number
): string {
  if (total === 0) {
    return `No products available for ${label.toLowerCase()}.`;
  }

  return `${covered} of ${total} products have ${label.toLowerCase()}.`;
}

function countVerifiedImages(feedData: ReadinessFeedData): number {
  return feedData.products.reduce((count, product) => {
    const manifestEntries = feedData.imageManifest[product.id] ?? [];
    return resolveGmcPrimaryImage(manifestEntries) ? count + 1 : count;
  }, 0);
}

export function buildGoogleMerchantReadiness({
  merchant,
  trustProfile,
  feedData,
}: BuildGoogleMerchantReadinessInput): MerchantCenterReadiness {
  const totalProducts = feedData.products.length;

  const withBrand = feedData.products.filter((product) =>
    isPresent(product.brand)
  ).length;
  const withIdentifier = feedData.products.filter(
    (product) => isPresent(product.gtin) || isPresent(product.mpn)
  ).length;
  const withGoogleCategory = feedData.products.filter((product) =>
    isPresent(product.google_product_category)
  ).length;
  const withVerifiedImage = countVerifiedImages(feedData);

  const supportContact = isAnyPresent([
    trustProfile.supportEmail,
    trustProfile.supportPhone,
    trustProfile.whatsappNumber,
    merchant.support_email,
    merchant.support_phone,
  ]);

  const checks: MerchantCenterReadinessCheck[] = [
    {
      id: 'support-contact',
      label: 'Support contact',
      severity: supportContact ? 'pass' : 'fail',
      message: supportContact
        ? 'A public support contact is available for shoppers and review teams.'
        : 'Add a support email, phone number, or WhatsApp contact.',
    },
    {
      id: 'social-profiles',
      label: 'Social profiles',
      severity:
        Object.keys(trustProfile.socialLinks).length > 0 ? 'pass' : 'warn',
      message:
        Object.keys(trustProfile.socialLinks).length > 0
          ? 'At least one social profile is connected.'
          : 'Add a social profile to reinforce store trust.',
    },
    {
      id: 'legal-identity',
      label: 'Legal identity',
      severity:
        trustProfile.legalEntityName ||
        trustProfile.registeredAddress ||
        trustProfile.taxIdentificationNumber
          ? 'pass'
          : 'warn',
      message:
        trustProfile.legalEntityName ||
        trustProfile.registeredAddress ||
        trustProfile.taxIdentificationNumber
          ? 'Business identity details are present.'
          : 'Add your legal entity name or registration details.',
    },
    {
      id: 'return-policy',
      label: 'Return policy',
      severity: trustProfile.returnPolicy ? 'pass' : 'warn',
      message: trustProfile.returnPolicy
        ? 'Return policy basics are published.'
        : 'Publish a clear return policy before launching Merchant Center.',
    },
    {
      id: 'shipping-policy',
      label: 'Shipping policy',
      severity: trustProfile.shippingPolicy ? 'pass' : 'warn',
      message: trustProfile.shippingPolicy
        ? 'Shipping policy basics are published.'
        : 'Publish a clear shipping policy before launching Merchant Center.',
    },
    {
      id: 'brand-coverage',
      label: 'Brand coverage',
      severity: coverageSeverity(withBrand, totalProducts, 'fail'),
      message: buildCoverageMessage(
        'brand information',
        withBrand,
        totalProducts
      ),
    },
    {
      id: 'image-coverage',
      label: 'Image coverage',
      severity: coverageSeverity(withVerifiedImage, totalProducts, 'fail'),
      message: buildCoverageMessage(
        'verified primary images',
        withVerifiedImage,
        totalProducts
      ),
    },
    {
      id: 'identifier-coverage',
      label: 'Identifier coverage',
      severity: coverageSeverity(withIdentifier, totalProducts, 'warn'),
      message: buildCoverageMessage(
        'GTIN or MPN identifiers',
        withIdentifier,
        totalProducts
      ),
    },
    {
      id: 'google-category-coverage',
      label: 'Google category coverage',
      severity: coverageSeverity(withGoogleCategory, totalProducts, 'warn'),
      message: buildCoverageMessage(
        'Google product categories',
        withGoogleCategory,
        totalProducts
      ),
    },
  ];

  return {
    checks,
    totals: {
      products: totalProducts,
      withBrand,
      withIdentifier,
      withGoogleCategory,
      withVerifiedImage,
    },
  };
}
