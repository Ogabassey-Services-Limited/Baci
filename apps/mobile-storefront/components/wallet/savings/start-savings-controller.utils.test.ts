import { describe, expect, it, jest } from '@jest/globals';
import type { Product } from '@/types/product';
import {
  applyStartSavingsProductSelection,
  getErrorMessage,
  INSUFFICIENT_WALLET_ERROR_CODE,
  isInsufficientWalletError,
  readParam,
  toProductChoice,
  toSelectedProductChoice,
  validateStartSavingsForm,
} from './start-savings-controller.utils';

const selectedProduct = {
  id: 'product-1',
  image: 'https://example.com/iphone.jpg',
  name: 'iPhone 13 Pro Max',
  price: 800000,
  slug: 'iphone-13-pro-max',
};
const productFixture: Product = {
  ...selectedProduct,
  condition: 'uk_used',
  image: 'https://example.com/iphone.jpg',
  variant_attributes: { storage: ['128GB', '256GB'] },
  variants: [
    {
      attributes: { color: 'Black', storage: '256GB' },
      condition: 'new',
      id: 'variant-1',
      image: 'https://example.com/iphone-variant.jpg',
      name: 'iPhone 13 Pro Max 256GB',
      price: 850000,
    },
  ],
};

describe('start savings controller utils', () => {
  it('reads route params and maps products to savings choices', () => {
    expect(readParam(['product-1', 'product-2'])).toBe('product-1');
    expect(readParam('product-1')).toBe('product-1');
    expect(toProductChoice(productFixture)).toEqual({
      ...selectedProduct,
      conditionLabel: 'Used',
      image: 'https://example.com/iphone.jpg',
      variantLabel: 'Storage: 128GB / 256GB',
    });
    expect(
      toSelectedProductChoice({
        product: productFixture,
        variantId: 'variant-1',
      })
    ).toEqual({
      ...selectedProduct,
      conditionLabel: 'New',
      image: 'https://example.com/iphone-variant.jpg',
      price: 850000,
      variantLabel: 'Storage: 256GB',
    });
  });

  it('applies selected product state while preserving manual target overrides', () => {
    const setFormError = jest.fn();
    const setSearchValue = jest.fn();
    const setSelectedProduct = jest.fn();
    const setTargetAmount = jest.fn();

    applyStartSavingsProductSelection({
      product: productFixture,
      setFormError,
      setSearchValue,
      setSelectedProduct,
      setTargetAmount,
      variantId: 'variant-1',
    });

    const updateTargetAmount = setTargetAmount.mock.calls[0]?.[0] as (
      current: string
    ) => string;

    expect(setFormError).toHaveBeenCalledWith(null);
    expect(setSearchValue).toHaveBeenCalledWith('iPhone 13 Pro Max');
    expect(setSelectedProduct).toHaveBeenCalledWith(
      expect.objectContaining({ price: 850000, variantLabel: 'Storage: 256GB' })
    );
    expect(updateTargetAmount('')).toBe('850000');
    expect(updateTargetAmount('900000')).toBe('900000');
  });

  it('refreshes an auto-filled target when switching selected products', () => {
    const setTargetAmount = jest.fn();

    applyStartSavingsProductSelection({
      previousSelectedProduct: {
        ...selectedProduct,
        conditionLabel: 'Used',
        price: 800000,
        variantLabel: 'Storage: 128GB',
      },
      product: productFixture,
      setSearchValue: jest.fn(),
      setSelectedProduct: jest.fn(),
      setTargetAmount,
      variantId: 'variant-1',
    });

    const updateTargetAmount = setTargetAmount.mock.calls[0]?.[0] as (
      current: string
    ) => string;

    expect(updateTargetAmount('800000')).toBe('850000');
    expect(updateTargetAmount('900000')).toBe('900000');
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
