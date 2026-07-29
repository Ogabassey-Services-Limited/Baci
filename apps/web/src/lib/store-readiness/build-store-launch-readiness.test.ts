import { describe, expect, it } from 'vitest';
import type { LaunchPaymentRequirement } from '@/lib/checkout/payment-gateway-availability';
import {
  buildStoreLaunchReadiness,
  type StoreLaunchFacts,
} from './build-store-launch-readiness';

const BANK_ACCOUNT_REQUIREMENT: LaunchPaymentRequirement = {
  id: 'bank_account',
  label: 'Add bank account',
  description: 'Required to receive payments via Paystack',
  completed: true,
};

const PAYMENT_METHOD_REQUIREMENT: LaunchPaymentRequirement = {
  id: 'payment_method',
  label: 'Enable a payment method',
  description: 'Pay on Delivery is enabled for customer checkout',
  completed: true,
};

const BASE_FACTS = {
  merchantId: 'merchant-123',
  slug: 'ready-store',
  country: 'NG',
  supportEmail: 'support@example.com',
  supportPhone: null,
  merchantEmail: null,
  merchantPhone: null,
  activeProductCount: 5,
  totalProductCount: 8,
  kycRequired: true,
  hasVerifiedIdentity: true,
  paymentRequirement: BANK_ACCOUNT_REQUIREMENT,
} satisfies StoreLaunchFacts;

function itemCompletion(
  facts: StoreLaunchFacts,
  itemId: string
): boolean | undefined {
  return buildStoreLaunchReadiness(facts).items.find(
    (item) => item.id === itemId
  )?.completed;
}

describe('buildStoreLaunchReadiness', () => {
  it.each([
    [
      'does not require KYC',
      { kycRequired: false, hasVerifiedIdentity: false },
      'verify_kyc',
      true,
    ],
    [
      'requires an unverified KYC identity',
      { hasVerifiedIdentity: false },
      'verify_kyc',
      false,
    ],
    [
      'accepts a verified KYC identity',
      { hasVerifiedIdentity: true },
      'verify_kyc',
      true,
    ],
    [
      'uses a completed bank-account payment requirement',
      { paymentRequirement: BANK_ACCOUNT_REQUIREMENT },
      'bank_account',
      true,
    ],
    [
      'uses a completed payment-method requirement',
      { paymentRequirement: PAYMENT_METHOD_REQUIREMENT },
      'payment_method',
      true,
    ],
    ['rejects a whitespace-only store URL', { slug: '  ' }, 'store_url', false],
    [
      'requires one active product',
      { activeProductCount: 0 },
      'first_product',
      false,
    ],
    ['rejects a whitespace-only country', { country: '  ' }, 'country', false],
    [
      'requires a reachable contact',
      {
        supportEmail: ' ',
        supportPhone: ' ',
        merchantEmail: ' ',
        merchantPhone: ' ',
      },
      'contact_info',
      false,
    ],
    [
      'accepts the merchant account email as contact information',
      { supportEmail: null, merchantEmail: 'owner@example.com' },
      'contact_info',
      true,
    ],
    [
      'accepts the support email as contact information',
      {
        supportEmail: 'support@example.com',
        merchantEmail: null,
        merchantPhone: null,
      },
      'contact_info',
      true,
    ],
    [
      'accepts the merchant owner phone as contact information',
      {
        supportEmail: null,
        merchantEmail: null,
        merchantPhone: '+2348000000000',
      },
      'contact_info',
      true,
    ],
    [
      'accepts the support phone as contact information',
      {
        supportEmail: null,
        supportPhone: '+2348000000000',
        merchantEmail: null,
        merchantPhone: null,
      },
      'contact_info',
      true,
    ],
  ] as const)('%s', (_name, changes, itemId, expectedCompleted) => {
    expect(itemCompletion({ ...BASE_FACTS, ...changes }, itemId)).toBe(
      expectedCompleted
    );
  });

  it('keeps exactly one dynamic payment item when the requirement changes', () => {
    const bankAccount = buildStoreLaunchReadiness({
      ...BASE_FACTS,
      paymentRequirement: BANK_ACCOUNT_REQUIREMENT,
    });
    const paymentMethod = buildStoreLaunchReadiness({
      ...BASE_FACTS,
      paymentRequirement: PAYMENT_METHOD_REQUIREMENT,
    });

    expect(bankAccount.items.map((item) => item.id)).toContain('bank_account');
    expect(bankAccount.items.map((item) => item.id)).not.toContain(
      'payment_method'
    );
    expect(paymentMethod.items.map((item) => item.id)).toContain(
      'payment_method'
    );
    expect(paymentMethod.items.map((item) => item.id)).not.toContain(
      'bank_account'
    );
    expect(bankAccount.totalRequired).toBe(paymentMethod.totalRequired);
  });

  it('uses active products for completion while retaining total products as diagnostics', () => {
    const result = buildStoreLaunchReadiness({
      ...BASE_FACTS,
      activeProductCount: 1,
      totalProductCount: 0,
    });

    expect(result.activeProductCount).toBe(1);
    expect(result.totalProductCount).toBe(0);
    expect(
      itemCompletion(
        { ...BASE_FACTS, activeProductCount: 1, totalProductCount: 0 },
        'first_product'
      )
    ).toBe(true);
  });

  it('derives readiness only from the required items', () => {
    const result = buildStoreLaunchReadiness({
      ...BASE_FACTS,
      country: null,
    });

    expect(result.isReady).toBe(
      result.completedRequired === result.totalRequired
    );
  });
});
