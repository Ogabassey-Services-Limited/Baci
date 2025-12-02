import {
  CheckoutFormSkeleton,
  OrderSummarySkeleton,
} from '@/components/ui/skeletons';

/**
 * Loading state for checkout page
 */
export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <CheckoutFormSkeleton />
          <OrderSummarySkeleton />
        </div>
      </div>
    </div>
  );
}
