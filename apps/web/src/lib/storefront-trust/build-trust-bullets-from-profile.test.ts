import { describe, expect, it } from 'vitest';
import { buildTrustBulletsFromProfile } from './build-trust-bullets-from-profile';

describe('buildTrustBulletsFromProfile', () => {
  it('derives return, nationwide shipping, and WhatsApp trust bullets', () => {
    expect(
      buildTrustBulletsFromProfile({
        returnPolicy: {
          windowDays: 7,
          returnFees: 'free',
          localRoute: '/returns',
        },
        shippingPolicy: {
          regions: ['NG'],
          summary: 'Nationwide delivery',
          localRoute: '/shipping',
        },
        whatsappNumber: '+2348000000000',
      })
    ).toEqual([
      'Free returns within 7 days',
      'Ships across Nigeria',
      'WhatsApp support available',
    ]);
  });

  it('keeps non-free return wording and omits unavailable bullets', () => {
    expect(
      buildTrustBulletsFromProfile({
        returnPolicy: {
          windowDays: 3,
          returnFees: 'customer_pays',
          localRoute: '/returns',
        },
        shippingPolicy: {
          regions: ['GH'],
          summary: 'Accra only',
          localRoute: '/shipping',
        },
      })
    ).toEqual(['Returns within 3 days']);
  });
});
