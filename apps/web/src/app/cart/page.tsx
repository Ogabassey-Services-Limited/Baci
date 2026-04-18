import { Suspense } from 'react';
import { RootCartPageContent } from './root-cart-page-content';

export const metadata = {
  title: 'Shopping Cart | Baci',
  description: 'View your shopping cart',
};

function RootCartPageFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white text-sm text-gray-500"
      role="status"
    >
      Loading cart...
    </div>
  );
}

export default function RootCartPage() {
  return (
    <Suspense fallback={<RootCartPageFallback />}>
      <RootCartPageContent />
    </Suspense>
  );
}
