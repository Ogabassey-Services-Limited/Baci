import { ProductDetailSkeleton, StorefrontHeaderSkeleton } from '@/components/ui/skeletons';

/**
 * Loading state for category product detail pages
 * Applies to all product pages within categories across all merchant storefronts
 */
export default function CategoryProductLoading() {
  return (
    <div className="min-h-screen">
      <StorefrontHeaderSkeleton />
      <div className="container mx-auto px-4 py-8">
        <ProductDetailSkeleton />
      </div>
    </div>
  );
}
