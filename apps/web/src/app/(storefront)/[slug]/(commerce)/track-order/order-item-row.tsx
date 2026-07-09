import { formatOrderItemOptionLabel } from '@baci/shared/lib';
import Image from 'next/image';

export interface TrackOrderItem {
  id: string;
  product_name: string;
  condition?: string | null;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_image?: string;
}

interface OrderItemRowProps {
  currency: string;
  formatCurrency: (amount: number, currency?: string) => string;
  item: TrackOrderItem;
}

export function OrderItemRow({
  currency,
  formatCurrency,
  item,
}: OrderItemRowProps) {
  const optionLabel = formatOrderItemOptionLabel({
    condition: item.condition,
    variantName: item.variant_name,
  });

  return (
    <div className="flex gap-4">
      {item.product_image && (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <Image
            alt={item.product_name}
            className="object-cover"
            fill
            sizes="64px"
            src={item.product_image}
          />
        </div>
      )}
      <div className="flex-1">
        <p className="font-medium">{item.product_name}</p>
        {optionLabel && (
          <p className="text-sm text-muted-foreground">{optionLabel}</p>
        )}
        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
      </div>
      <div className="text-right">
        <p className="font-medium">
          {formatCurrency(item.total_price, currency)}
        </p>
      </div>
    </div>
  );
}
