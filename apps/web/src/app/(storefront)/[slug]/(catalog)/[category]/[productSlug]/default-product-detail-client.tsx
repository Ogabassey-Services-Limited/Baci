'use client';

import dynamic from 'next/dynamic';
import type { Product } from '@/lib/products';

const ProductDetailClient = dynamic(
  () =>
    import(
      '@/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client'
    )
);

interface DefaultProductDetailClientProps {
  product: Product;
}

export function DefaultProductDetailClient({
  product,
}: DefaultProductDetailClientProps) {
  return <ProductDetailClient product={product} />;
}
