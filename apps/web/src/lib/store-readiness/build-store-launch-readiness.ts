import type {
  StoreLaunchReadinessItemId,
  StoreReadinessItem,
} from '@baci/shared';
import type { LaunchPaymentRequirement } from '@/lib/checkout/payment-gateway-availability';

export interface StoreLaunchFacts {
  merchantId: string;
  slug: string | null;
  country: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  merchantEmail: string | null;
  merchantPhone: string | null;
  activeProductCount: number;
  totalProductCount: number;
  kycRequired: boolean;
  hasVerifiedIdentity: boolean;
  paymentRequirement: LaunchPaymentRequirement;
}

export interface StoreLaunchReadiness {
  merchantId: string;
  slug: string;
  activeProductCount: number;
  totalProductCount: number;
  completedRequired: number;
  totalRequired: number;
  isReady: boolean;
  items: StoreReadinessItem<StoreLaunchReadinessItemId>[];
}

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function buildStoreLaunchReadiness(
  facts: StoreLaunchFacts
): StoreLaunchReadiness {
  const items: StoreReadinessItem<StoreLaunchReadinessItemId>[] = [
    {
      id: 'verify_kyc',
      label: 'Verify your identity (KYC)',
      description: facts.kycRequired
        ? 'NIN, BVN, or CAC required for payments'
        : 'Required before enabling Nigerian online payouts',
      completed: !facts.kycRequired || facts.hasVerifiedIdentity,
      priority: facts.kycRequired ? 'required' : 'recommended',
      category: 'payments',
    },
    {
      ...facts.paymentRequirement,
      priority: 'required',
      category: 'payments',
    },
    {
      id: 'store_url',
      label: 'Set your store URL',
      description: 'Choose a unique web address for your store',
      completed: hasText(facts.slug),
      priority: 'required',
      category: 'store',
    },
    {
      id: 'first_product',
      label: 'Publish your first product',
      description: 'You need at least one published product to start selling',
      completed: facts.activeProductCount >= 1,
      priority: 'required',
      category: 'products',
    },
    {
      id: 'country',
      label: 'Set your country/region',
      description: 'Determines currency, shipping options, and tax settings',
      completed: hasText(facts.country),
      priority: 'required',
      category: 'store',
    },
    {
      id: 'contact_info',
      label: 'Add contact information',
      description: 'Let customers know how to reach you',
      completed: [
        facts.supportEmail,
        facts.supportPhone,
        facts.merchantEmail,
        facts.merchantPhone,
      ].some(hasText),
      priority: 'required',
      category: 'store',
    },
  ];
  const requiredItems = items.filter((item) => item.priority === 'required');
  const completedRequired = requiredItems.filter(
    (item) => item.completed
  ).length;

  return {
    merchantId: facts.merchantId,
    slug: facts.slug?.trim() ?? '',
    activeProductCount: facts.activeProductCount,
    totalProductCount: facts.totalProductCount,
    completedRequired,
    totalRequired: requiredItems.length,
    isReady: completedRequired === requiredItems.length,
    items,
  };
}
