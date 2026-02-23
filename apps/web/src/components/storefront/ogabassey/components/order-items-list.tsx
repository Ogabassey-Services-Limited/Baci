import Image from 'next/image';
import Link from 'next/link';
import type { StorefrontOrderItem } from '@/types/storefront-order';

interface OrderItemsListProps {
  items: StorefrontOrderItem[];
  getUrl: (path: string) => string;
}

/**
 * Renders the list of items in a storefront order.
 */
export function OrderItemsList({ items, getUrl }: OrderItemsListProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
        <h2 className="font-bold text-gray-900 text-sm">
          Items ({items?.length || 0})
        </h2>
      </div>
      <div className="p-4 space-y-4">
        {items?.map((item) => (
          <div
            key={item.id}
            className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0"
          >
            <Link
              href={getUrl(`/product/${item.product_id}`)}
              className="w-20 h-20 bg-gray-50 rounded-xl p-2 border border-gray-100 flex-shrink-0 block"
            >
              <Image
                src={
                  item.product_image ||
                  item.image ||
                  (item.product_images && item.product_images[0]) ||
                  '/placeholder.png'
                }
                alt={item.product_name || item.name || 'Product image'}
                width={80}
                height={80}
                className="w-full h-full object-contain mix-blend-multiply"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={getUrl(`/product/${item.product_id}`)}>
                <h3 className="font-bold text-gray-900 text-sm mb-1 hover:text-red-600 transition-colors">
                  {item.product_name || item.name}
                </h3>
              </Link>
              <p className="text-xs text-gray-500 mb-2">Qty: {item.quantity}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: 'NGN',
                  }).format(item.price || 0)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
