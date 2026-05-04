/**
 * Kuda Bills Extension
 *
 * Generic bill purchase and category-based biller lookup.
 * Extends the core kuda.ts library for electricity, cable TV, and betting.
 */

import { withKudaElectricityBillItems } from '@baci/shared/lib';
import {
  type Biller,
  generateRequestRef,
  getBillersByType,
  KudaServiceType,
  kudaRequest,
  type PurchaseResult,
  verifyBillCustomer,
} from './kuda';

// Re-export for convenience
export {
  type Biller,
  getBillersByType,
  type PurchaseResult,
  verifyBillCustomer,
};

/**
 * Maps API bill type strings to Kuda's expected category names.
 * Keys must match the billTypeEnum values in schemas/vtu.ts,
 * NOT the BillType enum values in kuda.ts (which differ for 'data').
 */
const KUDA_CATEGORY_NAMES: Record<string, string> = {
  airtime: 'Airtime',
  data: 'Internet Data',
  electricity: 'Electricity',
  cable_tv: 'CableTv',
  betting: 'Betting',
};

function normalizeKudaString(value: number | string | null | undefined) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

/**
 * Get billers for a bill category using our enum.
 * Convenience wrapper that maps API bill type strings to Kuda category names.
 */
export async function getBillersByCategory(
  category: string
): Promise<Biller[]> {
  const kudaName = KUDA_CATEGORY_NAMES[category];
  if (!kudaName) {
    throw new Error(`Unknown bill category: ${category}`);
  }

  const billers = await getBillersByType(kudaName);

  return category === 'electricity'
    ? withKudaElectricityBillItems(billers)
    : billers;
}

/**
 * Generic bill purchase for non-airtime/data services.
 * Works for electricity, cable TV, and betting using ADMIN_PURCHASE_BILL.
 *
 * Same Kuda service type as purchaseAirtime/purchaseData but with
 * flexible identifiers instead of hardcoded provider codes.
 * @param customerName - Customer's name for the Kuda transaction record.
 */
export async function purchaseBill(
  billItemIdentifier: string,
  customerIdentification: string,
  amount: number,
  customerName: string = 'Customer',
  requestRef?: string
): Promise<PurchaseResult> {
  const reference = requestRef || generateRequestRef();

  try {
    // Kuda may return the vend token under different field names depending on
    // the biller type (pin/Pin for airtime, meterToken/vendCode/token for
    // electricity, voucher for betting, etc.).
    const response = await kudaRequest<{
      Reference?: string;
      reference?: string;
      Pin?: number | string | null;
      pin?: number | string | null;
      PIN?: number | string | null;
      Token?: number | string | null;
      token?: number | string | null;
      MeterToken?: number | string | null;
      meterToken?: number | string | null;
      VendCode?: number | string | null;
      vendCode?: number | string | null;
      Voucher?: number | string | null;
      voucher?: number | string | null;
    }>(
      KudaServiceType.ADMIN_PURCHASE_BILL,
      {
        CustomerFirstName: customerName,
        CustomerIdentifier: customerIdentification,
        PhoneNumber: customerIdentification,
        BillItemIdentifier: billItemIdentifier,
        Amount: Math.round(amount * 100).toString(), // Convert Naira to Kobo
        trackingReference: reference,
      },
      reference
    );

    const pin =
      normalizeKudaString(response.data?.pin) ??
      normalizeKudaString(response.data?.Pin) ??
      normalizeKudaString(response.data?.PIN) ??
      normalizeKudaString(response.data?.token) ??
      normalizeKudaString(response.data?.Token) ??
      normalizeKudaString(response.data?.meterToken) ??
      normalizeKudaString(response.data?.MeterToken) ??
      normalizeKudaString(response.data?.vendCode) ??
      normalizeKudaString(response.data?.VendCode) ??
      normalizeKudaString(response.data?.voucher) ??
      normalizeKudaString(response.data?.Voucher);
    const transactionId =
      normalizeKudaString(response.data?.reference) ??
      normalizeKudaString(response.data?.Reference);

    return {
      success: response.status,
      reference,
      transactionId,
      ...(pin && { pin }),
      message: response.message,
      status: response.status ? 'successful' : 'failed',
      amount,
    };
  } catch (error) {
    return {
      success: false,
      reference,
      message: error instanceof Error ? error.message : 'Bill purchase failed',
      status: 'failed',
      amount,
    };
  }
}
