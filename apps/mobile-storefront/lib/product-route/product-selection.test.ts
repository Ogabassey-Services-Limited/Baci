import { resolveDefaultVariantSelection } from '@baci/shared/lib';
import { describe, expect, it } from '@jest/globals';
import { normalizeRouteCondition } from '@/lib/product-route/normalize-route-condition';
import {
  baseProduct,
  secondaryVariant,
  variantProduct,
} from '@/lib/product-route/product-detail-screen.fixtures';
import { computeProductSelectionState } from '@/lib/product-route/product-selection';
import type { Product } from '@/types/product';

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

    // resolveDefaultVariantSelection follows condition preference first, so
    // the "used" variant is picked over the "new" fixture entry.
    const expectedDefault = secondaryVariant;
    expect(result.currentVariantDisplaySelection?.variant.id).toBe(
      expectedDefault.id
    );
    expect(result.effectiveSelectedCondition).toBe(expectedDefault.condition);
    expect(result.effectiveSelectedVariantId).toBe(expectedDefault.id);
  });

  it('seeds the initial condition from the purchasable default variant', () => {
    const product: Product = {
      ...variantProduct,
      variants: [
        {
          id: 'variant-used-sold-out',
          name: '128GB WiFi Used',
          condition: 'used',
          price: 500000,
          stock_quantity: 0,
          attributes: {
            storage: '128GB',
            connectivity: 'WiFi',
          },
        },
        {
          id: 'variant-new-in-stock',
          name: '128GB WiFi New',
          condition: 'new',
          price: 552000,
          stock_quantity: 5,
          attributes: {
            storage: '128GB',
            connectivity: 'WiFi',
          },
        },
      ],
    };
    const defaultVariantSelection = resolveDefaultVariantSelection(product);

    const result = computeProductSelectionState({
      defaultVariantSelection,
      product,
      routeCondition: null,
      routeSelectionAttributes: {},
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: null,
      selectedCondition: null,
      selectedStorage: null,
      selectedVariant: null,
    });

    expect(result.availableConditions).toEqual(['used', 'new']);
    expect(result.fallbackSelectedCondition).toBe('new');
    expect(result.currentVariantDisplaySelection?.variant.id).toBe(
      'variant-new-in-stock'
    );
    expect(result.currentVariantSelection?.variant.id).toBe(
      'variant-new-in-stock'
    );
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

  it('falls back to product available_conditions when variant rows do not expose a condition axis', () => {
    const conditionFallbackVariantProduct: Product = {
      ...variantProduct,
      available_conditions: ['new', 'used'],
      offers: undefined,
      variants: (variantProduct.variants ?? []).map((variant) => ({
        ...variant,
        condition: undefined,
      })),
    };
    const result = computeProductSelectionState({
      defaultVariantSelection: resolveDefaultVariantSelection(
        conditionFallbackVariantProduct
      ),
      product: conditionFallbackVariantProduct,
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
    expect(result.availableConditions).toEqual(['used', 'new']);
    expect(result.effectiveSelectedCondition).toBe('used');
  });

  it('orders fallback conditions from cheapest storefront condition to newest', () => {
    const conditionFallbackProduct: Product = {
      ...baseProduct,
      available_conditions: ['new', 'open_box', 'used'],
      offers: undefined,
      condition: 'Multiple Conditions',
    };

    const result = computeProductSelectionState({
      defaultVariantSelection: null,
      product: conditionFallbackProduct,
      routeCondition: null,
      routeSelectionAttributes: {},
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: null,
      selectedCondition: null,
      selectedStorage: null,
      selectedVariant: null,
    });

    expect(result.availableConditions).toEqual(['used', 'open_box', 'new']);
    expect(result.fallbackSelectedCondition).toBe('used');
  });

  it('matches legacy variants that store the color axis under `colour`', () => {
    const legacyColourProduct: Product = {
      ...variantProduct,
      color_images: {},
      colors: ['Forest Green', 'Crimson'],
      variant_attributes: {
        ...(variantProduct.variant_attributes ?? {}),
        colour: ['Forest Green', 'Crimson'],
      },
      variants: [
        {
          ...primaryVariant,
          id: 'variant-legacy-forest',
          condition: undefined,
          attributes: {
            storage: '128GB',
            colour: 'Forest Green',
          },
        },
        {
          ...secondaryVariant,
          id: 'variant-legacy-crimson',
          condition: undefined,
          attributes: {
            storage: '128GB',
            colour: 'Crimson',
          },
        },
      ],
    };

    const result = computeProductSelectionState({
      defaultVariantSelection:
        resolveDefaultVariantSelection(legacyColourProduct),
      product: legacyColourProduct,
      routeCondition: null,
      routeSelectionAttributes: {},
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: 'Crimson',
      selectedCondition: null,
      selectedStorage: '128GB',
      selectedVariant: null,
    });

    expect(result.currentVariantDisplaySelection?.variant.id).toBe(
      'variant-legacy-crimson'
    );
    expect(result.effectiveSelectedColor).toBe('Crimson');
  });

  it('resolves mixed-catalog color aliases without requiring both keys on a single variant', () => {
    const mixedAliasProduct: Product = {
      ...variantProduct,
      color_images: {},
      colors: ['Forest Green', 'Crimson'],
      variant_attributes: {
        ...(variantProduct.variant_attributes ?? {}),
        color: ['Forest Green'],
        colour: ['Crimson'],
      },
      variants: [
        {
          ...primaryVariant,
          id: 'variant-mixed-forest',
          condition: undefined,
          attributes: {
            storage: '128GB',
            color: 'Forest Green',
          },
        },
        {
          ...secondaryVariant,
          id: 'variant-mixed-crimson',
          condition: undefined,
          attributes: {
            storage: '128GB',
            colour: 'Crimson',
          },
        },
      ],
    };

    const modernResult = computeProductSelectionState({
      defaultVariantSelection:
        resolveDefaultVariantSelection(mixedAliasProduct),
      product: mixedAliasProduct,
      routeCondition: null,
      routeSelectionAttributes: {},
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: 'Forest Green',
      selectedCondition: null,
      selectedStorage: '128GB',
      selectedVariant: null,
    });

    expect(modernResult.currentVariantDisplaySelection?.variant.id).toBe(
      'variant-mixed-forest'
    );

    const legacyResult = computeProductSelectionState({
      defaultVariantSelection:
        resolveDefaultVariantSelection(mixedAliasProduct),
      product: mixedAliasProduct,
      routeCondition: null,
      routeSelectionAttributes: {},
      routeVariantId: null,
      selectedAttributes: {},
      selectedColor: 'Crimson',
      selectedCondition: null,
      selectedStorage: '128GB',
      selectedVariant: null,
    });

    expect(legacyResult.currentVariantDisplaySelection?.variant.id).toBe(
      'variant-mixed-crimson'
    );
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
