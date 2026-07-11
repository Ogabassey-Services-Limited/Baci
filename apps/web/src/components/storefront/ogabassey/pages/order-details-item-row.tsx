'use client';

import { ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { asRoute } from '@/lib/routes';
import { CdnFormatImage } from '@/components/storefront/cdn-format-image';
import { getStorefrontOrderItemHref } from '@/lib/storefront-order-item-href';
import type { StorefrontOrderItem } from '@/types/storefront-order';

const NGN_CURRENCY: Intl.NumberFormat = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

interface OrderDetailsItemRowProps {
  item: StorefrontOrderItem;
  basePath: string;
}

function getOrderItemImage(item: StorefrontOrderItem): string | null {
  return (
    item.product_image ||
    item.image ||
    item.image_url ||
    item.product_images?.[0] ||
    null
  );
}

export function OrderDetailsItemRow({
  item,
  basePath,
}: OrderDetailsItemRowProps) {
  const productHref = getStorefrontOrderItemHref(item, basePath);
  const imageSrc = getOrderItemImage(item);
  const productName = item.product_name || item.name;
  const [hasImageError, setHasImageError] = useState(false);
  const shouldRenderImage = Boolean(imageSrc && !hasImageError);
  const image = (
    <div
      aria-label={
        shouldRenderImage
          ? undefined
          : `No product image available for ${productName}`
      }
      className="ogabassey-product-card-image-surface size-20 bg-gray-50 rounded-xl p-2 border border-gray-100 shrink-0 flex items-center justify-center relative overflow-hidden"
      role={shouldRenderImage ? undefined : 'img'}
    >
      {imageSrc && !hasImageError ? (
        <CdnFormatImage
          src={imageSrc}
          alt={productName}
          fill
          sizes="80px"
          className="object-contain mix-blend-multiply p-2"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <ReceiptText
          aria-hidden="true"
          className="size-8 text-gray-300"
          strokeWidth={1.8}
        />
      )}
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
              {NGN_CURRENCY.format(item.price || 0)}
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
            {NGN_CURRENCY.format(item.price || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
