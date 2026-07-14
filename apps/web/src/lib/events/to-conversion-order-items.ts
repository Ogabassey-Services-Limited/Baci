import { logger } from '@/lib/logger';
import type { OrderConversionData } from '@/lib/offline-conversions';

type ConversionOrderItemInput = {
  id?: string | null;
  name?: string | null;
  price?: number | string | null;
  product_id?: string | null;
  quantity?: number | null;
};

function requiredString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (
    typeof value === 'string' &&
    !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())
  ) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toConversionOrderItems({
  failOnInvalidItem,
  items,
  orderId,
}: {
  failOnInvalidItem?: boolean;
  items?: ConversionOrderItemInput[] | null;
  orderId: string;
}): OrderConversionData['items'] {
  return (items ?? []).flatMap((item, itemIndex) => {
    const id = requiredString(item.product_id) ?? requiredString(item.id);
    const name = requiredString(item.name);
    const price = finiteNumber(item.price);
    const quantity = finiteNumber(item.quantity);
    const invalidFields = [
      id ? null : 'product_id',
      name ? null : 'name',
      price !== null && price >= 0 ? null : 'price',
      quantity !== null && quantity > 0 ? null : 'quantity',
    ].filter((field): field is string => field !== null);

    if (
      !id ||
      !name ||
      price === null ||
      price < 0 ||
      quantity === null ||
      quantity <= 0
    ) {
      const details = {
        invalidFields,
        itemIndex,
        message: 'Skipping invalid order item for conversion tracking',
        orderId,
      };
      if (failOnInvalidItem) {
        logger.error({
          ...details,
          message: 'Invalid order item for conversion tracking',
        });
        throw new Error(
          `Invalid order item for conversion tracking: order=${orderId}, item=${itemIndex}, fields=${invalidFields.join(',')}`
        );
      }
      logger.warn(details);
      return [];
    }

    return [{ id, name, price, quantity }];
  });
}
