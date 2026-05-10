import { describe, expect, it } from 'vitest';
import { financialConsistency } from '@/lib/payments/financial-consistency';

// Δ-31 / Δ-32 / Δ-37 / Δ-38: an order is financially consistent when its
// `total` matches the right shape for its `tax_basis`. NULL tax_basis means
// the A0 backfill couldn't classify it (the order is in the
// reconciliation_review queue) — treat as inconsistent so FIRS / loyalty
// hold off until ops resolves it. Tolerance is ₦1 per the plan.

const baseOrder = {
  subtotal: 0,
  shipping_fee: 0,
  gift_wrapping_fee: 0,
  tax_amount: 0,
  discount_amount: 0,
  total: 0,
};

describe('financialConsistency', () => {
  describe('tax_basis = "exclusive"', () => {
    it('matches when total = subtotal + shipping + gift + tax - discount', () => {
      const result = financialConsistency({
        ...baseOrder,
        tax_basis: 'exclusive',
        subtotal: 810_000,
        shipping_fee: 25_000,
        tax_amount: 60_750,
        total: 895_750,
      });
      expect(result.consistent).toBe(true);
    });

    it('tolerates ±₦1 rounding', () => {
      const result = financialConsistency({
        ...baseOrder,
        tax_basis: 'exclusive',
        subtotal: 1000,
        shipping_fee: 100,
        tax_amount: 75,
        total: 1176,
      });
      expect(result.consistent).toBe(true);
    });

    it('flags inconsistent when total excludes tax (Efosa case)', () => {
      // Real Efosa shape: tax_amount=60_750 but total=835_000 (subtotal + shipping only).
      const result = financialConsistency({
        ...baseOrder,
        tax_basis: 'exclusive',
        subtotal: 810_000,
        shipping_fee: 25_000,
        tax_amount: 60_750,
        total: 835_000,
      });
      expect(result.consistent).toBe(false);
      if (!result.consistent) {
        expect(result.reason).toBe('financial_totals_inconsistent');
      }
    });

    it('respects gift_wrapping_fee in the sum', () => {
      const result = financialConsistency({
        ...baseOrder,
        tax_basis: 'exclusive',
        subtotal: 1000,
        shipping_fee: 100,
        gift_wrapping_fee: 250,
        tax_amount: 75,
        total: 1425,
      });
      expect(result.consistent).toBe(true);
    });

    it('subtracts discount_amount from the sum', () => {
      const result = financialConsistency({
        ...baseOrder,
        tax_basis: 'exclusive',
        subtotal: 2000,
        shipping_fee: 0,
        tax_amount: 150,
        discount_amount: 200,
        total: 1950,
      });
      expect(result.consistent).toBe(true);
    });
  });

  describe('tax_basis = "inclusive"', () => {
    it('matches when total = subtotal + shipping + gift - discount (tax already inside)', () => {
      const result = financialConsistency({
        ...baseOrder,
        tax_basis: 'inclusive',
        subtotal: 1075,
        shipping_fee: 100,
        tax_amount: 75,
        total: 1175,
      });
      expect(result.consistent).toBe(true);
    });

    it('flags inconsistent when total adds tax on top despite inclusive basis', () => {
      const result = financialConsistency({
        ...baseOrder,
        tax_basis: 'inclusive',
        subtotal: 1075,
        shipping_fee: 100,
        tax_amount: 75,
        total: 1250,
      });
      expect(result.consistent).toBe(false);
      if (!result.consistent) {
        expect(result.reason).toBe('financial_totals_inconsistent');
      }
    });
  });

  describe('tax_basis IS NULL', () => {
    it('is always inconsistent (A0 backfill couldn’t classify the shape)', () => {
      const result = financialConsistency({
        ...baseOrder,
        tax_basis: null,
        subtotal: 810_000,
        shipping_fee: 25_000,
        tax_amount: 60_750,
        total: 835_000,
      });
      expect(result.consistent).toBe(false);
      if (!result.consistent) {
        expect(result.reason).toBe('tax_basis_unclassified');
      }
    });
  });

  describe('null/undefined tolerance for optional fields', () => {
    it('treats null gift_wrapping_fee, tax_amount, discount_amount as 0', () => {
      const result = financialConsistency({
        tax_basis: 'exclusive',
        subtotal: 1000,
        shipping_fee: 100,
        gift_wrapping_fee: null,
        tax_amount: null,
        discount_amount: null,
        total: 1100,
      });
      expect(result.consistent).toBe(true);
    });
  });
});
