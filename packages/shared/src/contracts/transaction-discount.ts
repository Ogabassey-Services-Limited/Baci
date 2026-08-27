/**
 * Server-authored discount provenance persisted with an order.  The line id
 * comes from `order_items.line_id`, so consumers do not depend on the order in
 * which Supabase returns the embedded relation.
 */
export const TRANSACTION_DISCOUNT_METADATA_KEY = 'baci_transaction_discount';

export interface TransactionDiscountLineAllocation {
  lineId: number;
  merchandiseDiscount: number;
  vatRelief: number;
}

export interface TransactionDiscountMetadata {
  lineDiscounts: Array<TransactionDiscountLineAllocation | null>;
  version: 2;
}
