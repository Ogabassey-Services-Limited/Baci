import { describe, expect, it } from 'vitest';
import type { CartItem } from '@/hooks/cart';
import { calculateCartTotal, sanitizeCartItems } from './cart-entitlement-sanitizer';

describe('cart-entitlement-sanitizer', () => {
  const mockCart: CartItem[] = [
    {
      id: '1',
      cartItemId: '1::v1',
      name: 'Item 1',
      price: 1000,
      quantity: 2,
      negotiatedPrice: 800,
      negotiationStatus: 'accepted',
      cartDiscount: 400,
      hasAssurance: true,
      assuranceRate: 0.05,
    } as CartItem,
    {
      id: '2',
      cartItemId: '2::v2',
      name: 'Item 2',
      price: 2000,
      quantity: 1,
      hasAssurance: false,
    } as CartItem,
  ];

  describe('sanitizeCartItems', () => {
    it('should strip negotiation fields when hasPriceNegotiation is false', () => {
      const sanitized = sanitizeCartItems(mockCart, false);
      expect(sanitized[0].negotiatedPrice).toBeUndefined();
      expect(sanitized[0].negotiationStatus).toBeUndefined();
      expect(sanitized[0].cartDiscount).toBeUndefined();
      // Should not touch standard fields
      expect(sanitized[0].price).toBe(1000);
      expect(sanitized[0].quantity).toBe(2);
      expect(sanitized[0].hasAssurance).toBe(true);

      // Item 2 should remain unchanged
      expect(sanitized[1].price).toBe(2000);
    });

    it('should preserve negotiation fields when hasPriceNegotiation is true', () => {
      const sanitized = sanitizeCartItems(mockCart, true);
      expect(sanitized[0].negotiatedPrice).toBe(800);
      expect(sanitized[0].negotiationStatus).toBe('accepted');
      expect(sanitized[0].cartDiscount).toBe(400);
    });
  });

  describe('calculateCartTotal', () => {
    it('should calculate total with standard prices and quantity-aware assurance when negotiation is not entitled', () => {
      // Item 1: price = 1000, qty = 2, itemTotal = 2000. hasAssurance = true, assurance = 2000 * 0.05 = 100. Total = 2100.
      // Item 2: price = 2000, qty = 1, itemTotal = 2000. hasAssurance = false, assurance = 0. Total = 2000.
      // Total = 4100.
      const total = calculateCartTotal(mockCart, false);
      expect(total).toBe(4100);
    });

    it('should calculate total with negotiated prices and quantity-aware assurance when negotiation is entitled', () => {
      // Item 1: negotiatedPrice = 800, qty = 2, itemTotal = 1600. hasAssurance = true, assurance = 1600 * 0.05 = 80. Total = 1680.
      // Item 2: price = 2000, qty = 1, itemTotal = 2000. hasAssurance = false, assurance = 0. Total = 2000.
      // Total = 3680.
      const total = calculateCartTotal(mockCart, true);
      expect(total).toBe(3680);
    });
  });
});
