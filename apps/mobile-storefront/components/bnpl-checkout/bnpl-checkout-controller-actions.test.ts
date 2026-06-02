import { describe, expect, it, jest } from '@jest/globals';
import {
  resolveBNPLNavigationUrlEffect,
  resolveBNPLPopupTargetAction,
  shouldHandleBNPLNavigationMessage,
} from './bnpl-checkout-controller-actions';

jest.mock('./bnpl-checkout-message-handler', () => ({
  logBNPLCheckoutDebug: jest.fn(),
}));

describe('resolveBNPLNavigationUrlEffect', () => {
  it('returns success with the extracted reference for order success URLs', () => {
    expect(
      resolveBNPLNavigationUrlEffect(
        'https://shop.example.com/order-success?reference=ref_123'
      )
    ).toEqual({
      reference: 'ref_123',
      status: 'success',
    });
  });

  it('returns cancelled payment errors for checkout cancellation URLs', () => {
    expect(
      resolveBNPLNavigationUrlEffect(
        'https://shop.example.com/checkout?cancelled=true'
      )
    ).toEqual({
      errorMessage: 'Payment was cancelled.',
      status: 'error',
    });
  });

  it('returns parsed error messages for checkout error URLs', () => {
    expect(
      resolveBNPLNavigationUrlEffect(
        'https://shop.example.com/checkout?error=Provider%20declined'
      )
    ).toEqual({
      errorMessage: 'Provider declined',
      status: 'error',
    });
  });

  it('ignores unrelated navigation URLs', () => {
    expect(
      resolveBNPLNavigationUrlEffect('https://shop.example.com/products')
    ).toBeNull();
  });
});

describe('shouldHandleBNPLNavigationMessage', () => {
  const apiBaseUrl = 'https://www.baci.shop';

  it('accepts trusted merchant return URLs', () => {
    expect(
      shouldHandleBNPLNavigationMessage({
        apiBaseUrl,
        merchantSlug: 'demo',
        url: 'https://www.baci.shop/demo/order-success?reference=ref_123',
      })
    ).toBe(true);
  });

  it('rejects provider-origin navigation messages', () => {
    expect(
      shouldHandleBNPLNavigationMessage({
        apiBaseUrl,
        merchantSlug: 'demo',
        url: 'https://pay.example-provider.com/success?reference=ref_123',
      })
    ).toBe(false);
  });
});

describe('resolveBNPLPopupTargetAction', () => {
  const apiBaseUrl = 'https://www.baci.shop';

  it('ignores blank provider popup windows', () => {
    expect(
      resolveBNPLPopupTargetAction({
        apiBaseUrl,
        targetUrl: 'about:blank#blocked',
      })
    ).toEqual({ type: 'ignore' });
  });

  it('loads trusted merchant popup return URLs', () => {
    expect(
      resolveBNPLPopupTargetAction({
        apiBaseUrl,
        merchantSlug: 'demo',
        targetUrl: 'https://www.baci.shop/demo/checkout/bnpl?_rsc=abc',
      })
    ).toEqual({
      targetUrl: 'https://www.baci.shop/demo/checkout/bnpl',
      type: 'load',
    });
  });

  it('rejects untrusted auxiliary windows', () => {
    expect(
      resolveBNPLPopupTargetAction({
        apiBaseUrl,
        merchantSlug: 'demo',
        targetUrl: 'https://evil.example/checkout/bnpl',
      })
    ).toEqual({
      targetUrl: 'https://evil.example/checkout/bnpl',
      type: 'untrusted',
    });
  });
});
