import { resolveDefaultVariantSelection } from '@baci/shared/lib';
import { describe, expect, it } from '@jest/globals';
import type { Product } from '@/types/product';
import { normalizeRouteCondition } from '@/lib/product-route/normalize-route-condition';
import {
  baseProduct,
  primaryVariant,
  secondaryVariant,
  variantProduct,
} from '@/lib/product-route/product-detail-screen.fixtures';
import { computeProductSelectionState } from '@/lib/product-route/product-selection';

describe('product selection', () => {
  it('uses the default variant selection when no explicit selection is present', () => {
    const defaultVariantSelection =
      resolveDefaultVariantSelection(variantProduct);
    const result = computeProductSelectionState({
      defaultVariantSelection,
      product: variantProduct,
      routeCondition: null,
      routeSelectionAttributes: {},
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: null,
      selectedCondition: null,
      selectedStorage: null,
      selectedVariant: null,
    });

    // resolveDefaultVariantSelection now prefers the lowest-price purchasable
    // variant, so the "used" variant is picked over the "new" fixture entry.
    const expectedDefault = secondaryVariant;
    expect(result.currentVariantDisplaySelection?.variant.id).toBe(
      expectedDefault.id
    );
    expect(result.effectiveSelectedCondition).toBe(expectedDefault.condition);
    expect(result.effectiveSelectedVariantId).toBe(expectedDefault.id);
  });

  it('returns empty selection state when product is null', () => {
    const result = computeProductSelectionState({
      defaultVariantSelection: null,
      product: null,
      routeCondition: null,
      routeSelectionAttributes: {},
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: null,
      selectedCondition: null,
      selectedStorage: null,
      selectedVariant: null,
    });

    expect(result.availableConditions).toEqual([]);
    expect(result.currentVariantDisplaySelection).toBeNull();
    expect(result.currentVariantSelection).toBeNull();
    expect(result.effectiveSelectedVariantId).toBeNull();
  });

  it('resolves the variant display selection from the route condition and attributes', () => {
    const result = computeProductSelectionState({
      defaultVariantSelection: resolveDefaultVariantSelection(variantProduct),
      product: variantProduct,
      routeCondition: 'used',
      routeSelectionAttributes: {
        connectivity: 'WiFi',
        storage: '128GB',
      },
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: null,
      selectedCondition: null,
      selectedStorage: null,
      selectedVariant: null,
    });

    expect(result.currentVariantDisplaySelection?.variant.id).toBe(
      'variant-used-128'
    );
    expect(result.effectiveSelectedCondition).toBe('used');
  });

  it('normalizes non-variant fallback conditions from legacy aliases', () => {
    const result = computeProductSelectionState({
      defaultVariantSelection: null,
      product: {
        ...baseProduct,
        offers: [
          {
            id: 'offer-1',
            condition: 'refurbished',
            price: 400000,
          },
        ],
      },
      routeCondition: null,
      routeSelectionAttributes: {},
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: null,
      selectedCondition: null,
      selectedStorage: null,
      selectedVariant: null,
    });

    expect(result.availableConditions).toEqual(['open_box']);
    expect(result.fallbackSelectedCondition).toBe('open_box');
    expect(normalizeRouteCondition('refurbished')).toBe('open_box');
  });

  it('keeps offer-backed conditions when variants do not have a condition axis', () => {
    const offerBackedVariantProduct: Product = {
      ...variantProduct,
      offers: [
        {
          id: 'offer-used',
          condition: 'used',
          price: 500000,
        },
      ],
      variants: (variantProduct.variants ?? []).map((variant) => ({
        ...variant,
        condition: undefined,
      })),
    };
    const result = computeProductSelectionState({
      defaultVariantSelection: resolveDefaultVariantSelection(
        offerBackedVariantProduct
      ),
      product: offerBackedVariantProduct,
      routeCondition: 'used',
      routeSelectionAttributes: {
        connectivity: 'WiFi',
        storage: '128GB',
      },
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: null,
      selectedCondition: null,
      selectedStorage: null,
      selectedVariant: null,
    });

    expect(result.usesVariantConditions).toBe(false);
    expect(result.availableConditions).toEqual(['used']);
    expect(result.effectiveSelectedCondition).toBe('used');
  });

  it('lets explicit storage and color selections override route attributes', () => {
    const coloredVariantProduct: Product = {
      ...variantProduct,
      color_images: {
        Silver: ['https://cdn.example.com/silver.jpg'],
      },
      variant_attributes: {
        ...(variantProduct.variant_attributes ?? {}),
        color: ['Silver'],
      },
      variants: (variantProduct.variants ?? []).map((variant) => ({
        ...variant,
        attributes: {
          ...(variant.attributes ?? {}),
          color: 'Silver',
        },
      })),
    };

    const result = computeProductSelectionState({
      defaultVariantSelection: resolveDefaultVariantSelection(
        coloredVariantProduct
      ),
      product: coloredVariantProduct,
      routeCondition: 'new',
      routeSelectionAttributes: {
        color: 'Gold',
        connectivity: 'WiFi',
        storage: '64GB',
      },
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: 'Silver',
      selectedCondition: null,
      selectedStorage: '128GB',
      selectedVariant: null,
    });

    expect(result.effectiveSelectedStorage).toBe('128GB');
    expect(result.effectiveSelectedColor).toBe('Silver');
  });
});
