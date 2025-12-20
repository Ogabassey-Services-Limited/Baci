import {
  ProductDetailSkeleton,
  StorefrontHeaderSkeleton,
} from '@/components/ui/skeletons';

/**
 * Loading state for product detail pages
 * Applies to all product pages across all merchant storefronts
 */
export default function ProductLoading() {
  return (
    <div className="min-h-screen bg-white">
      <StorefrontHeaderSkeleton />
      <div className="container mx-auto px-4 py-8">
        <ProductDetailSkeleton />
      </div>
    </div>
  );
}
