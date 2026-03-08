import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface ProductMobileActionBarProps {
  cartHref: string;
  onDecrement: () => void;
  onIncrement: () => void;
  onMobileAddToCart: (startRect: DOMRect) => void;
  quantityInCart: number;
}

export function ProductMobileActionBar({
  cartHref,
  onDecrement,
  onIncrement,
  onMobileAddToCart,
  quantityInCart,
}: ProductMobileActionBarProps) {
  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 border-t border-gray-200 bg-white p-3 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] md:hidden">
      {quantityInCart > 0 ? (
        <div className="flex gap-3">
          <div className="flex h-14 flex-1 items-center justify-between rounded-xl border-2 border-red-600 bg-white">
            <button
              type="button"
              onClick={onDecrement}
              className="flex h-full w-14 items-center justify-center rounded-l-xl border-r border-red-100 text-red-600 active:bg-red-50"
            >
              {quantityInCart === 1 ? <Trash2 size={20} /> : <Minus size={20} />}
            </button>
            <div className="flex flex-1 flex-col items-center justify-center">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                In Cart
              </span>
              <span className="text-lg font-bold text-gray-900">
                {quantityInCart}
              </span>
            </div>
            <button
              type="button"
              onClick={onIncrement}
              className="flex h-full w-14 items-center justify-center rounded-r-xl border-l border-red-100 text-red-600 active:bg-red-50"
            >
              <Plus size={20} />
            </button>
          </div>
          <Link
            href={cartHref}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white shadow-lg transition-all active:scale-[0.98] active:bg-red-700 active:shadow-none"
          >
            <ShoppingCart size={20} />
            View Cart
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={(event) =>
            onMobileAddToCart(event.currentTarget.getBoundingClientRect())
          }
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-600 font-bold text-white shadow-lg transition-all active:scale-[0.98] active:bg-red-700 active:shadow-none"
        >
          <ShoppingCart size={20} />
          Add to Cart
        </button>
      )}
    </div>
  );
}
