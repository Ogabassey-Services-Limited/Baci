import { Suspense } from 'react';
import { RootCartPageContent } from './root-cart-page-content';

export const metadata = {
  title: 'Shopping Cart | Baci',
  description: 'View your shopping cart',
};

function RootCartPageFallback() {
  return (
    <output className="flex min-h-screen items-center justify-center bg-linear-to-b from-gray-50 to-white text-sm text-gray-500">
      Loading cart…
    </output>
  );
}

export default function RootCartPage() {
  return (
    <Suspense fallback={<RootCartPageFallback />}>
      <RootCartPageContent />
    </Suspense>
  );
}
