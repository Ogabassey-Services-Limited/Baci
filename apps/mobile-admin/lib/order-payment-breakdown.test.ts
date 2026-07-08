import { describe, expect, it } from 'vitest';
import { buildOrderPaymentBreakdown } from './order-payment-breakdown';

const registeredMerchant = {
  vat_rate: 7.5,
  vat_registration_status: 'registered',
};

describe('buildOrderPaymentBreakdown', () => {
  it('surfaces VAT with the merchant rate for a tax-exclusive order', () => {
    // The exact order from the bug report: 210,000 + 25,000 + 15,750 = 250,750
    const breakdown = buildOrderPaymentBreakdown({
      currency: 'NGN',
      discountAmount: 0,
      merchant: registeredMerchant,
      shippingFee: 25000,
      subtotal: 210000,
      taxAmount: 15750,
      total: 250750,
    });

    expect(breakdown.showVat).toBe(true);
    expect(breakdown.taxAmount).toBe(15750);
    expect(breakdown.vatLabel).toBe('VAT (7.5%)');
    expect(breakdown.displaySubtotal).toBe(210000);
  });

  it('adjusts the display subtotal for tax-inclusive totals', () => {
    // Inclusive shape: total equals subtotal + shipping, tax stored within.
    const total = 235000;
    const taxAmount = total - total / 1.075;
    const breakdown = buildOrderPaymentBreakdown({
      currency: 'NGN',
      discountAmount: 0,
      merchant: registeredMerchant,
      shippingFee: 25000,
      subtotal: 210000,
      taxAmount,
      total,
    });

    expect(breakdown.showVat).toBe(true);
    // Subtotal shrinks so subtotal + shipping + VAT still equals the total.
    expect(
      breakdown.displaySubtotal + 25000 + breakdown.taxAmount
    ).toBeCloseTo(total, 2);
  });

  it('hides the VAT row when no tax was charged', () => {
    const breakdown = buildOrderPaymentBreakdown({
      merchant: registeredMerchant,
      shippingFee: 1000,
      subtotal: 5000,
      taxAmount: 0,
      total: 6000,
    });

    expect(breakdown.showVat).toBe(false);
  });

  it('still discloses stored tax when merchant settings are missing', () => {
    const breakdown = buildOrderPaymentBreakdown({
      subtotal: 100,
      taxAmount: 7.5,
      total: 107.5,
    });

    expect(breakdown.showVat).toBe(true);
    expect(breakdown.vatLabel).toBe('VAT');
    expect(breakdown.displaySubtotal).toBe(100);
  });

  it('balances inclusive VAT lines when merchant settings are missing', () => {
    const total = 235000;
    const taxAmount = total - total / 1.075;
    const breakdown = buildOrderPaymentBreakdown({
      currency: 'NGN',
      shippingFee: 25000,
      subtotal: 210000,
      taxAmount,
      total,
    });

    expect(breakdown.showVat).toBe(true);
    expect(breakdown.vatLabel).toBe('VAT');
    expect(
      breakdown.displaySubtotal + 25000 + breakdown.taxAmount
    ).toBeCloseTo(total, 2);
  });

  it('balances inclusive VAT lines when the current merchant rate changed', () => {
    const total = 235000;
    const taxAmount = total - total / 1.075;
    const breakdown = buildOrderPaymentBreakdown({
      currency: 'NGN',
      merchant: { vat_rate: 10, vat_registration_status: 'registered' },
      shippingFee: 25000,
      subtotal: 210000,
      taxAmount,
      total,
    });

    expect(breakdown.showVat).toBe(true);
    expect(breakdown.vatLabel).toBe('VAT (10%)');
    expect(
      breakdown.displaySubtotal + 25000 + breakdown.taxAmount
    ).toBeCloseTo(total, 2);
  });

  it('balances backfilled inclusive VAT lines with a discount and shipping', () => {
    const total = 1005125;
    const shippingFee = 1000;
    const discountAmount = 500;
    const taxAmount = 70125;
    const breakdown = buildOrderPaymentBreakdown({
      currency: 'NGN',
      discountAmount,
      shippingFee,
      subtotal: total,
      taxAmount,
      total,
    });

    expect(breakdown.displaySubtotal).toBe(934500);
    expect(
      breakdown.displaySubtotal + shippingFee - discountAmount + taxAmount
    ).toBe(total);
  });

  it('defaults the NGN VAT rate when the merchant has none configured', () => {
    const breakdown = buildOrderPaymentBreakdown({
      currency: 'NGN',
      merchant: { vat_rate: null, vat_registration_status: 'registered' },
      subtotal: 100,
      taxAmount: 7.5,
      total: 107.5,
    });

    expect(breakdown.vatLabel).toBe('VAT (7.5%)');
  });

  it('coerces nullish gift wrapping and wallet amounts to zero', () => {
    const breakdown = buildOrderPaymentBreakdown({
      giftWrappingFee: null,
      merchant: registeredMerchant,
      subtotal: 100,
      total: 100,
      walletAmountUsed: undefined,
    });

    expect(breakdown.giftWrappingFee).toBe(0);
    expect(breakdown.walletAmountUsed).toBe(0);
  });

  it('passes through positive gift wrapping and wallet amounts', () => {
    const breakdown = buildOrderPaymentBreakdown({
      giftWrappingFee: 1500,
      merchant: registeredMerchant,
      subtotal: 100,
      total: 100,
      walletAmountUsed: 2000,
    });

    expect(breakdown.giftWrappingFee).toBe(1500);
    expect(breakdown.walletAmountUsed).toBe(2000);
  });

  it('keeps inclusive VAT lines balanced when gift wrapping was charged', () => {
    const total = 238000;
    const giftWrappingFee = 3000;
    const taxAmount = total - total / 1.075;
    const breakdown = buildOrderPaymentBreakdown({
      currency: 'NGN',
      giftWrappingFee,
      merchant: registeredMerchant,
      shippingFee: 25000,
      subtotal: 210000,
      taxAmount,
      total,
    });

    expect(
      breakdown.displaySubtotal +
        25000 +
        breakdown.giftWrappingFee +
        breakdown.taxAmount
    ).toBeCloseTo(total, 2);
  });
});
