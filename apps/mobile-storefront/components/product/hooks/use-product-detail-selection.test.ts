import { describe, expect, it } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { variantProduct } from '@/lib/product-route/product-detail-screen.fixtures';
import { useProductDetailSelection } from './use-product-detail-selection';

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

describe('useProductDetailSelection', () => {
  it('seeds default variant-driven selections from product data', async () => {
    const { result } = renderHook(() =>
      useProductDetailSelection({
        getFallbackVariantSelections,
        getFirstImageIndexForColor,
        getSelectionSyncSignature,
        product: variantProduct,
        productGalleryImages: variantProduct.images ?? [variantProduct.image],
        productImageColorMap: {},
        resolvedColorImages: variantProduct.color_images,
        routeCondition: null,
        routeSelectionAttributes: {},
        routeSelectionSignature: JSON.stringify({
          attributes: {},
          condition: null,
          slug: variantProduct.slug,
          variantId: null,
        }),
        routeVariantId: null,
      })
    );

    await waitFor(() => {
      expect(result.current.selectedVariant).toBe('variant-used-128');
      expect(result.current.selectedStorage).toBe('128GB');
      expect(result.current.effectiveSelectedCondition).toBe('used');
    });
  });

});
