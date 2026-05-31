import { describe, expect, it } from '@jest/globals';
import type { Product } from '@/types/product';
import {
  getErrorMessage,
  INSUFFICIENT_WALLET_ERROR_CODE,
  isInsufficientWalletError,
  readParam,
  toProductChoice,
  validateStartSavingsForm,
} from './start-savings-controller.utils';

const selectedProduct = {
  id: 'product-1',
  name: 'iPhone 13 Pro Max',
  price: 800000,
  slug: 'iphone-13-pro-max',
};
const productFixture: Product = {
  ...selectedProduct,
  image: 'https://example.com/iphone.jpg',
};

describe('start savings controller utils', () => {
  it('reads route params and maps products to savings choices', () => {
    expect(readParam(['product-1', 'product-2'])).toBe('product-1');
    expect(readParam('product-1')).toBe('product-1');
    expect(toProductChoice(productFixture)).toEqual(selectedProduct);
  });

  it('normalizes error messages and insufficient wallet errors', () => {
    expect(getErrorMessage(new Error('Failed'), 'Fallback')).toBe('Failed');
    expect(getErrorMessage('bad', 'Fallback')).toBe('Fallback');
    expect(
      isInsufficientWalletError(
        Object.assign(new Error('no funds'), {
          code: INSUFFICIENT_WALLET_ERROR_CODE,
        })
      )
    ).toBe(true);
    expect(isInsufficientWalletError(new Error('insufficient wallet'))).toBe(
      true
    );
    expect(
      isInsufficientWalletError(
        new Error('wallet is insufficiently configured')
      )
    ).toBe(false);
  });

  it('validates required savings form fields in order', () => {
    const validInput = {
      acceptsNonWithdrawableTerms: true,
      contributionValue: 20000,
      initialContributionEnabled: false,
      initialContributionValue: 0,
      paymentProvider: 'paystack',
      selectedProduct,
      sourceMode: 'manual' as const,
      targetValue: 800000,
    };

    expect(validateStartSavingsForm(validInput)).toBeNull();
    expect(
      validateStartSavingsForm({ ...validInput, selectedProduct: null })
    ).toBe('Select the product you want to save for.');
    expect(validateStartSavingsForm({ ...validInput, targetValue: 0 })).toBe(
      'Enter a valid target amount.'
    );
    expect(
      validateStartSavingsForm({ ...validInput, contributionValue: 0 })
    ).toBe('Enter a valid contribution amount.');
    expect(
      validateStartSavingsForm({
        ...validInput,
        initialContributionEnabled: true,
        initialContributionValue: 0,
      })
    ).toBe('Enter your initial contribution amount.');
    expect(
      validateStartSavingsForm({
        ...validInput,
        initialContributionEnabled: true,
        initialContributionValue: 1000,
        paymentProvider: 'paystack',
        sourceMode: 'auto_debit',
      })
    ).toBe(
      'Initial contributions are only supported with manual debit for now.'
    );
    expect(
      validateStartSavingsForm({
        ...validInput,
        initialContributionEnabled: true,
        initialContributionValue: 1000,
        paymentProvider: 'test-provider',
        sourceMode: 'auto_debit',
      })
    ).toBe(
      'Initial contributions are only supported with manual debit for now.'
    );
    expect(
      validateStartSavingsForm({
        ...validInput,
        acceptsNonWithdrawableTerms: false,
      })
    ).toBe('You must accept the non-withdrawable savings terms.');
  });
});
