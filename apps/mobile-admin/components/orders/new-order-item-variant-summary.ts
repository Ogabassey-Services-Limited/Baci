import type { OrderItem } from '@/components/orders/new-order.types';
import { formatProductCondition } from '@/lib/product-condition';
import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';

type VariantSummaryItem = Pick<
  OrderItem,
  'condition' | 'variant_attributes' | 'variant_name'
>;

export function getOrderItemVariantSummary(
  item?: VariantSummaryItem | null
): string {
  return (
    item?.variant_name?.trim() ||
    formatVariantAttributesSummary(item?.variant_attributes) ||
    formatProductCondition(item?.condition) ||
    ''
  );
}
