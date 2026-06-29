import { ShoppingCart } from 'lucide-react';

export function CartPageHeader({ cartCount }: { cartCount: number }) {
  return (
    <div className="flex items-center mb-6 shrink-0">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <ShoppingCart className="text-store-primary fill-red-600" />
        Cart{' '}
        <span className="text-gray-400 text-lg font-medium">
          ({cartCount})
        </span>
      </h1>
    </div>
  );
}
