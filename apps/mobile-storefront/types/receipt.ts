/**
 * Receipt/Invoice types for the mobile storefront
 * Inferred from Zod schemas in schemas/receipt.ts
 */

import type { z } from 'zod';
import type {
  MerchantReceiptInfoSchema,
  ReceiptDetailSchema,
  ReceiptListItemSchema,
} from '@/schemas/receipt';

/** Minimal order data for the receipts list view */
export type ReceiptListItem = z.infer<typeof ReceiptListItemSchema>;

/** Full order data needed for receipt HTML generation */
export type ReceiptDetail = z.infer<typeof ReceiptDetailSchema>;

/** Merchant data needed for receipt branding */
export type MerchantReceiptInfo = z.infer<typeof MerchantReceiptInfoSchema>;
