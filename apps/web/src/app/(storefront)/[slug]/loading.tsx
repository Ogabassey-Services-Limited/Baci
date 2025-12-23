import { StorefrontPageSkeleton } from '@/components/ui/skeletons';

/**
 * Loading state for merchant storefronts
 * This skeleton is shown while any merchant's storefront data loads
 * Applies dynamically to all merchant stores
 */
export default function StorefrontLoading() {
  return <StorefrontPageSkeleton />;
}
