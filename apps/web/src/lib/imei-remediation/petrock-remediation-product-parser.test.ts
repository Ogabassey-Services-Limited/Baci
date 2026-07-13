import { describe, expect, it } from 'vitest';
import { parsePetrockRemediationProduct } from './petrock-remediation-product-parser';

describe('parsePetrockRemediationProduct', () => {
  it('parses a clean AT&T model-and-status unlock as review-pending', () => {
    const parsed = parsePetrockRemediationProduct({
      categoryId: 'C210',
      categoryName: 'AT&T USA Network Unlock',
      fields: [{ name: 'IMEI' }],
      name: 'AT&T Clean Unlock - iPhone 17 Series Only - 82% Success',
      priceUsd: 75,
      productId: 'unlock-1',
      turnaround: '1-7 Days',
    });

    expect(parsed).toMatchObject({
      carrier: 'AT&T',
      excludedReason: null,
      isActive: false,
      modelScope: { kind: 'range', max: 17, min: 17 },
      refundPolicy: 'refundable',
      reviewStatus: 'pending',
      statusSegment: 'clean',
      successRate: 82,
    });
  });

  it.each([
    'AT&T Unbarring/Cleaning - Blacklisted IMEIs Supported',
    'AT&T Unlock - Blacklisted Supported',
    'Reported Lost by Insurance to Clean',
    'iCloud FMI Removal',
    'MDM/FRP Removal',
    'Owner Info Removal',
    'Refund Request Service',
  ])('excludes unsafe or non-order product: %s', (name) => {
    const parsed = parsePetrockRemediationProduct({
      categoryId: 'C210',
      categoryName: 'AT&T',
      fields: [{ name: 'IMEI' }],
      name,
      priceUsd: 50,
      productId: 'unsafe',
      turnaround: '1-7 Days',
    });

    expect(parsed?.excludedReason).toBeTruthy();
    expect(parsed?.isActive).toBe(false);
  });

  it('rejects null-price and multi-input products before curation', () => {
    expect(
      parsePetrockRemediationProduct({
        categoryId: 'C210',
        categoryName: 'AT&T',
        fields: [{ name: 'IMEI' }, { name: 'Owner Name' }],
        name: 'AT&T Clean Unlock',
        priceUsd: null,
        productId: 'invalid',
        turnaround: '1-7 Days',
      })?.excludedReason
    ).toBe('invalid_product_contract');
  });

  it('excludes an unlock when its parent category is a laundering service', () => {
    const parsed = parsePetrockRemediationProduct({
      categoryId: 'C210',
      categoryName: 'AT&T Unbarring/Cleaning - Blacklisted Supported',
      fields: [{ name: 'IMEI' }],
      name: 'iPhone Network Unlock - 1-7 Days',
      priceUsd: 50,
      productId: 'unsafe-category',
      turnaround: '1-7 Days',
    });

    expect(parsed.excludedReason).toBe('blacklist_laundering');
    expect(parsed.isActive).toBe(false);
  });

  it('classifies any explicit no-refund wording conservatively', () => {
    const parsed = parsePetrockRemediationProduct({
      categoryId: 'C210',
      categoryName: 'AT&T USA Network Unlock',
      fields: [{ name: 'IMEI' }],
      name: 'AT&T Clean Unlock - No Refund',
      priceUsd: 50,
      productId: 'no-refund',
      turnaround: '1-7 Days',
    });

    expect(parsed.refundPolicy).toBe('no_refund_denial');
  });
});
