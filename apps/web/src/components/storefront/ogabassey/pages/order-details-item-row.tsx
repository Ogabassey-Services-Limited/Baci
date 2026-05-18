'use client';

import Image from 'next/image';
import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import { getStorefrontOrderItemHref } from '@/lib/storefront-order-item-href';
import type { StorefrontOrderItem } from '@/types/storefront-order';

interface OrderDetailsItemRowProps {
  item: StorefrontOrderItem;
  basePath: string;
}

function getOrderItemImage(item: StorefrontOrderItem): string {
  return (
    item.product_image || item.image || item.product_images?.[0] || '/placeholder.png'
  );
}

export function OrderDetailsItemRow({
  item,
  basePath,
}: OrderDetailsItemRowProps) {
  const productHref = getStorefrontOrderItemHref(item, basePath);
  const imageSrc = getOrderItemImage(item);
  const productName = item.product_name || item.name;
  const image = (
    <div className="w-20 h-20 bg-gray-50 rounded-xl p-2 border border-gray-100 shrink-0 block relative overflow-hidden">
      <Image
        src={imageSrc}
        alt={productName}
        fill
        sizes="80px"
        className="object-contain mix-blend-multiply p-2"
      />
    </div>
  );

  if (!productHref) {
    return (
      <div className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0">
        {image}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm mb-1">
            {productName}
          </h3>
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
    );
  }

  return (
    <div className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0">
      <Link href={asRoute(productHref)}>{image}</Link>
      <div className="flex-1 min-w-0">
        <Link href={asRoute(productHref)}>
          <h3 className="font-bold text-gray-900 text-sm mb-1 hover:text-red-600 transition-colors">
            {productName}
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
  );
}
