import { describe, expect, it } from 'vitest';
import { resolveChargeCurrency } from './resolve-charge-currency';

describe('resolveChargeCurrency', () => {
  describe('server-authoritative currency', () => {
    it('charges the order currency when the client sends nothing', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'NGN',
        clientCurrency: undefined,
        gateway: 'paystack',
      });

      expect(result).toEqual({ ok: true, currency: 'NGN' });
    });

    it('charges the order currency when the client agrees', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'NGN',
        clientCurrency: 'NGN',
        gateway: 'paystack',
      });

      expect(result).toEqual({ ok: true, currency: 'NGN' });
    });

    it('falls back to NGN for a legacy order with no stamped currency', () => {
      const result = resolveChargeCurrency({
        orderCurrency: null,
        clientCurrency: undefined,
        gateway: 'korapay',
      });

      expect(result).toEqual({ ok: true, currency: 'NGN' });
    });

    it('normalizes casing and whitespace on the order currency', () => {
      const result = resolveChargeCurrency({
        orderCurrency: '  ghs ',
        clientCurrency: undefined,
        gateway: 'korapay',
      });

      expect(result).toEqual({ ok: true, currency: 'GHS' });
    });

    it('treats the client currency case-insensitively when matching', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'GHS',
        clientCurrency: 'ghs',
        gateway: 'korapay',
      });

      expect(result).toEqual({ ok: true, currency: 'GHS' });
    });
  });

  describe('currency mismatch (client disagrees with order)', () => {
    it('rejects when the client explicitly sends a different currency', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'NGN',
        clientCurrency: 'USD',
        gateway: 'paystack',
      });

      expect(result).toEqual({
        ok: false,
        error: 'Payment currency does not match the order currency',
        code: 'CURRENCY_MISMATCH',
      });
    });

    it('checks mismatch before gateway support', () => {
      // Client sends USD, order is GHS, gateway is NGN-only. Mismatch must win.
      const result = resolveChargeCurrency({
        orderCurrency: 'GHS',
        clientCurrency: 'USD',
        gateway: 'paystack',
      });

      expect(result).toMatchObject({ code: 'CURRENCY_MISMATCH' });
    });
  });

  describe('unsupported currency (gateway cannot charge it)', () => {
    it('charges GHS on korapay (multi-currency rail)', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'GHS',
        clientCurrency: 'GHS',
        gateway: 'korapay',
      });

      expect(result).toEqual({ ok: true, currency: 'GHS' });
    });

    it('rejects a gateway-ineligible currency instead of coercing to NGN', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'INR',
        clientCurrency: undefined,
        gateway: 'korapay',
      });

      expect(result).toEqual({
        ok: false,
        error: 'The selected payment method cannot charge INR',
        code: 'UNSUPPORTED_CURRENCY',
      });
    });

    it('rejects a non-NGN order routed to paystack (NGN-only)', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'GHS',
        clientCurrency: undefined,
        gateway: 'paystack',
      });

      expect(result).toMatchObject({ code: 'UNSUPPORTED_CURRENCY' });
    });

    it('rejects a non-NGN order routed to juicyway (NGN fiat leg only)', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'KES',
        clientCurrency: undefined,
        gateway: 'juicyway',
      });

      expect(result).toMatchObject({ code: 'UNSUPPORTED_CURRENCY' });
    });

    it('rejects a non-NGN order routed to klump (NGN BNPL)', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'ZAR',
        clientCurrency: undefined,
        gateway: 'klump',
      });

      expect(result).toMatchObject({ code: 'UNSUPPORTED_CURRENCY' });
    });

    it('rejects a non-NGN order routed to credit_direct (NGN BNPL)', () => {
      const result = resolveChargeCurrency({
        orderCurrency: 'GHS',
        clientCurrency: undefined,
        gateway: 'credit_direct',
      });

      expect(result).toMatchObject({ code: 'UNSUPPORTED_CURRENCY' });
    });

    it('allows NGN on every NGN-only gateway', () => {
      for (const gateway of [
        'paystack',
        'klump',
        'credit_direct',
        'credpal',
        'juicyway',
      ] as const) {
        expect(
          resolveChargeCurrency({
            orderCurrency: 'NGN',
            clientCurrency: undefined,
            gateway,
          })
        ).toEqual({ ok: true, currency: 'NGN' });
      }
    });
  });
});
