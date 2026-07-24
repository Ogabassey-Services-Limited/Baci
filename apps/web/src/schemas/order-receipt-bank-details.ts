import { z } from 'zod';

/**
 * Request contract for the S0-B order-scoped receipt/bank-details boundary
 * (`GET /api/storefront/orders/[id]/receipt-bank-details`).
 *
 * `orderId` comes from the route path; `token` is the optional guest capability
 * (the order's unguessable `tracking_token`). When no token is supplied the
 * caller must be an authenticated owner (customer, or the store's merchant
 * owner/staff) — authorization is enforced inside
 * `get_order_receipt_bank_details`, never by the request shape alone.
 */
export const orderReceiptBankDetailsRequestSchema = z.object({
  orderId: z.uuid(),
  token: z.string().trim().min(1).max(256).optional(),
});

export type OrderReceiptBankDetailsRequest = z.infer<
  typeof orderReceiptBankDetailsRequestSchema
>;

/**
 * The exact bounded projection returned to the client. Mirrors the fixed
 * receipt shape of `get_storefront_receipt_merchant_info` so the mobile
 * receipt screen can switch to this order-scoped endpoint verbatim.
 */
export interface OrderReceiptBankDetails {
  business_name: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  support_email: string | null;
  support_phone: string | null;
  rider_phone_number: string | null;
  business_address: string | null;
  cac_rc_number: string | null;
  tax_identification_number: string | null;
  legal_entity_name: string | null;
  brand_colors: unknown;
  vat_registration_status: string | null;
  vat_rate: number | null;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  social_media: unknown;
  pages: unknown;
}
