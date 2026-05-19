import { describe, expect, it } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  baseProduct,
  variantProduct,
} from '@/lib/product-route/product-detail-screen.fixtures';
import { useProductDetailSelection } from './use-product-detail-selection';

type HookArgs = Parameters<typeof useProductDetailSelection>[0];

const getFallbackVariantSelections = () => ({
  attributes: {
    connectivity: 'WiFi',
    storage: '128GB',
  },
  color: null,
  storage: '128GB',
});

const getFirstImageIndexForColor = () => 0;

const getSelectionSyncSignature = () => 'selection-sync-signature';

function routeSelectionSignature({
  attributes = {},
  condition = null,
  variantId = null,
}: {
  attributes?: Record<string, string>;
  condition?: string | null;
  variantId?: string | null;
}) {
  return JSON.stringify({
    attributes,
    condition,
    slug: variantProduct.slug,
    variantId,
  });
}

function createHookArgs(overrides: Partial<HookArgs> = {}): HookArgs {
  const routeSelectionAttributes = overrides.routeSelectionAttributes ?? {};
  const routeCondition = overrides.routeCondition ?? null;
  const routeVariantId = overrides.routeVariantId ?? null;

  return {
    getFallbackVariantSelections,
    getFirstImageIndexForColor,
    getSelectionSyncSignature,
    product: variantProduct,
    productGalleryImages: variantProduct.images ?? [variantProduct.image],
    productImageColorMap: {},
    resolvedColorImages: variantProduct.color_images,
    routeCondition,
    routeSelectionAttributes,
    routeSelectionSignature:
      overrides.routeSelectionSignature ??
      routeSelectionSignature({
        attributes: routeSelectionAttributes,
        condition: routeCondition,
        variantId: routeVariantId,
      }),
    routeVariantId,
    ...overrides,
  };
}

describe('useProductDetailSelection', () => {
  it('returns empty selection state when product data is not loaded', () => {
    const { result } = renderHook(() =>
      useProductDetailSelection(createHookArgs({ product: null }))
    );

    expect(result.current.availableConditions).toEqual([]);
    expect(result.current.selectedVariant).toBeNull();
    expect(result.current.selectedStorage).toBeNull();
    expect(result.current.selectedColor).toBeNull();
    expect(result.current.selectedAttributes).toEqual({});
  });

  it('seeds default variant-driven selections from product data', async () => {
    const { result } = renderHook(() =>
      useProductDetailSelection(createHookArgs())
    );

    await waitFor(() => {
      expect(result.current.selectedVariant).toBe('variant-used-128');
      expect(result.current.selectedStorage).toBe('128GB');
      expect(result.current.effectiveSelectedCondition).toBe('used');
    });
  });

  it('seeds fallback selections when variant rows have not loaded yet', async () => {
    const { result } = renderHook(() =>
      useProductDetailSelection(
        createHookArgs({
          product: {
            ...baseProduct,
            color_images: {
              Gray: ['https://cdn.example.com/galaxy-tab-a11-plus-gray.jpg'],
            },
            colors: ['Gray'],
            has_variants: true,
            variant_attributes: {
              storage: ['128GB', '256GB'],
            },
            variants: [],
          },
        })
      )
    );

    await waitFor(() => {
      expect(result.current.selectedVariant).toBeNull();
      expect(result.current.selectedColor).toBeNull();
      expect(result.current.selectedStorage).toBe('128GB');
    });
  });

  it('reseeds from route params when the route selection signature changes', async () => {
    const { rerender, result } = renderHook(
      (args: HookArgs) => useProductDetailSelection(args),
      {
        initialProps: createHookArgs(),
      }
    );

    await waitFor(() => {
      expect(result.current.selectedVariant).toBe('variant-used-128');
    });

    act(() => {
      result.current.setHasCustomizedSelection(true);
      result.current.setSelectedVariant('variant-used-128');
    });

    rerender(
      createHookArgs({
        routeCondition: 'new',
        routeSelectionSignature: routeSelectionSignature({
          attributes: {},
          condition: 'new',
          variantId: 'variant-new-128',
        }),
        routeVariantId: 'variant-new-128',
      })
    );

    await waitFor(() => {
      expect(result.current.hasCustomizedSelection).toBe(false);
      expect(result.current.selectedVariant).toBe('variant-new-128');
      expect(result.current.selectedStorage).toBe('128GB');
      expect(result.current.effectiveSelectedCondition).toBe('new');
    });
  });

  it('repairs invalid local variant selections to a valid fallback', async () => {
    const { result } = renderHook(() =>
      useProductDetailSelection(createHookArgs())
    );

    await waitFor(() => {
      expect(result.current.selectedVariant).toBe('variant-used-128');
    });

    act(() => {
      result.current.setSelectedVariant('missing-variant');
      result.current.setSelectedStorage('512GB');
      result.current.setSelectedAttributes({
        connectivity: 'Cellular',
        storage: '512GB',
      });
      result.current.setSelectedCondition('refurbished');
    });

    await waitFor(() => {
      expect(result.current.selectedVariant).toBe('variant-used-128');
      expect(result.current.selectedStorage).toBe('128GB');
      expect(result.current.effectiveSelectedCondition).toBe('used');
      expect(result.current.effectiveSelectedVariantId).toBe(
        'variant-used-128'
      );
    });
  });

  it.each([
    ['null route condition', null, 'used'],
    ['unavailable route condition', 'refurbished', 'used'],
  ] as const)(
    'falls back to a valid condition for %s',
    async (_label, routeCondition, expectedCondition) => {
      const { result } = renderHook(() =>
        useProductDetailSelection(
          createHookArgs({
            routeCondition,
            routeSelectionSignature: routeSelectionSignature({
              condition: routeCondition,
            }),
          })
        )
      );

      await waitFor(() => {
        expect(result.current.selectedCondition).toBe(expectedCondition);
        expect(result.current.effectiveSelectedCondition).toBe(
          expectedCondition
        );
      });
    }
  );
});
