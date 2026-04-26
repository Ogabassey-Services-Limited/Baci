import { logger } from '@/lib/logger';
import type { JumiaOrderItem } from '@/schemas/jumia';
import type { CanonicalShippingStatus } from './order-sync-mappers';

type JumiaMoneyField = 'shippingAmount' | 'taxAmount' | 'voucherAmount';

export interface JumiaOrderMoney {
  total: number;
  subtotal: number;
  shippingFee: number;
  taxAmount: number;
  discountAmount: number;
  originalTotal: number;
}

export function calculateJumiaOrderMoney(
  orderId: string,
  totalAmount: number,
  items: JumiaOrderItem[]
): JumiaOrderMoney {
  const totalMinor = toMoneyMinorUnits(toFiniteMoney(totalAmount));
  const shippingFeeMinor = sumJumiaMoney(items, 'shippingAmount');
  const taxAmountMinor = sumJumiaMoney(items, 'taxAmount');
  const discountAmountMinor = sumJumiaMoney(items, 'voucherAmount');
  const rawSubtotalMinor =
    totalMinor - shippingFeeMinor - taxAmountMinor + discountAmountMinor;

  if (rawSubtotalMinor < 0) {
    logger.warn({
      message: 'Clamped negative Jumia order subtotal to zero',
      jumiaOrderId: orderId,
      rawSubtotalMinor,
      totalMinor,
      shippingFeeMinor,
      taxAmountMinor,
      discountAmountMinor,
    });
  }

  const subtotalMinor = Math.max(0, rawSubtotalMinor);
  return {
    total: fromMoneyMinorUnits(totalMinor),
    subtotal: fromMoneyMinorUnits(subtotalMinor),
    shippingFee: fromMoneyMinorUnits(shippingFeeMinor),
    taxAmount: fromMoneyMinorUnits(taxAmountMinor),
    discountAmount: fromMoneyMinorUnits(discountAmountMinor),
    originalTotal: fromMoneyMinorUnits(totalMinor + discountAmountMinor),
  };
}

export function mapJumiaPaymentStatus(
  shippingStatus: CanonicalShippingStatus,
  isPrepayment: boolean
): 'paid' | 'pending' | 'refunded' | 'unpaid' {
  if (shippingStatus === 'cancelled' || shippingStatus === 'returned') {
    // COD terminal orders have no captured payment to refund.
    return isPrepayment ? 'refunded' : 'unpaid';
  }
  return isPrepayment ? 'paid' : 'pending';
}

function sumJumiaMoney(items: JumiaOrderItem[], field: JumiaMoneyField) {
  return items.reduce((sum, item) => {
    const value = item[field];
    return sum + toMoneyMinorUnits(toFiniteMoney(value));
  }, 0);
}

function toMoneyMinorUnits(value: number) {
  return Math.round(value * 100);
}

function toFiniteMoney(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function fromMoneyMinorUnits(value: number) {
  return Number((value / 100).toFixed(2));
}
