/**
 * Product Comparison Screen
 * Side-by-side comparison of up to 3 products
 */

import { requiresProductSelection } from '@baci/shared/lib';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { CompareView } from '@/components/compare/CompareView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useCartStore } from '@/stores/cart-store';
import { useComparisonStore } from '@/stores/comparison-store';
import type { Product } from '@/types/product';

export default function CompareScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const { products, removeProduct, clearComparison } = useComparisonStore(
    useShallow((state) => ({
      products: state.products,
      removeProduct: state.removeProduct,
      clearComparison: state.clearComparison,
    }))
  );
  const addToCart = useCartStore((state) => state.addItem);

  // Collect all unique spec keys across all products
  const allSpecKeys = (() => {
    const keys = new Set<string>();
    for (const product of products) {
      if (product.specifications) {
        for (const key of Object.keys(product.specifications)) {
          keys.add(key);
        }
      }
    }
    return Array.from(keys);
  })();

  const handleAddToCart = (product: Product) => {
    if (requiresProductSelection(product)) {
      if (product.slug) {
        router.push(`/product/${product.slug}`);
      }
      return;
    }

    addToCart({
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      compare_at_price: product.compare_at_price,
      quantity: 1,
      image_url: product.image,
      condition: product.condition,
    });
  };

  return (
    <CompareView
      allSpecKeys={allSpecKeys}
      bottomInset={insets.bottom}
      colors={colors}
      onAddToCart={handleAddToCart}
      onBrowseProducts={() => router.push('/')}
      onClearComparison={clearComparison}
      onOpenProduct={(product) => router.push(`/product/${product.slug}`)}
      onRemoveProduct={removeProduct}
      products={products}
    />
  );
}
