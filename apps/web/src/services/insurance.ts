import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { createMyCoverClient, MYCOVER_PRODUCTS } from '@/lib/mycover';
import { formatPhoneForMyCover } from '@/lib/phone';
import { createClient } from '@/lib/supabase/server';

// Claim-status reconciliation (cron) lives in its own module to keep this file
// under the 300-line cap; re-exported so the import path stays stable.
export { syncClaimsStatus } from './insurance-claim-sync';

const DEFAULT_GADGET_PRODUCT_ID =
  process.env.MYCOVER_GADGET_PRODUCT_ID ||
  'eec0711c-1e4a-453b-a26c-2726e0a1a7cc';

export interface DeviceInsuranceDetails {
  imei: string;
  serialNumber: string;
  deviceColor: string;
  deviceModel: string;
  deviceMake: string;
  deviceType: 'Phone' | 'Laptop' | 'Others';
  deviceValue: number;
  purchaseDate: string; // YYYY-MM-DD
  devicePhotos: {
    about: string; // URL
  };
  customerPhoto?: string;
  // The order item the merchant entered these device details for. Binds the
  // policy to a deterministic SKU instead of whichever order_items row the DB
  // returns first.
  itemId?: string;
  // Real policyholder KYC — collected at confirmation so we stop sending
  // hardcoded placeholder values to the insurer.
  gender: 'Male' | 'Female';
  dateOfBirth: string; // YYYY-MM-DD
}

interface DatabaseOrderItem {
  id: string;
  has_assurance: boolean;
  assurance_fee?: number;
  price?: number;
  quantity?: number;
  name: string;
  [key: string]: unknown;
}

interface DatabaseOrder {
  id: string;
  merchant_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address?: {
    address?: string;
    [key: string]: unknown;
  };
  order_items: DatabaseOrderItem[];
  [key: string]: unknown;
}

/**
 * Purchase gadget insurance for a confirmed order (v2 API)
 */
export async function purchaseOrderInsurance(
  orderId: string,
  deviceDetails: DeviceInsuranceDetails,
  // Reuse the caller's already-authorized session. The confirm route may be
  // hit with a Bearer token (mobile), which has no cookies — falling back to a
  // cookie client there would read the order as anon and fail.
  client?: SupabaseClient
) {
  const supabase = client ?? createClient(await cookies());

  // 1. Fetch Order with Customer and Items
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, merchant_id, customer_name, customer_email, customer_phone,
      shipping_address,
      order_items (id, name, has_assurance, assurance_fee, price, quantity)
    `)
    .eq('id', orderId)
    .single();

  const typedOrder = order as unknown as DatabaseOrder;

  if (orderError || !typedOrder) {
    throw new Error(`Order not found: ${orderError?.message}`);
  }

  // 2. Filter for items that need assurance, then bind to a DETERMINISTIC item:
  // the merchant-selected `itemId` first, otherwise a stable order by id. The
  // embedded order_items fetch has no inherent ordering, so without this the
  // policy could be purchased for a different SKU than the device details the
  // merchant entered (and the intended item wrongly flagged as uninsured).
  const selectedItemId = deviceDetails.itemId;
  const insuredItems = typedOrder.order_items
    .filter((item: DatabaseOrderItem) => item.has_assurance)
    .sort((a, b) => {
      if (selectedItemId) {
        if (a.id === selectedItemId) return -1;
        if (b.id === selectedItemId) return 1;
      }
      return a.id.localeCompare(b.id);
    });

  if (insuredItems.length === 0) {
    return {
      success: false,
      message: 'No items in this order require assurance.',
    };
  }

  // If the merchant explicitly selected an item but it is no longer in the order
  // / no longer has assurance (stale dashboard or bad client), fail closed
  // rather than silently insuring a different SKU than the details describe.
  if (
    selectedItemId &&
    !insuredItems.some((item) => item.id === selectedItemId)
  ) {
    return {
      success: true,
      results: [
        {
          success: false,
          error:
            'Selected insurance item is no longer in the order or no longer has assurance.',
          itemId: selectedItemId,
        },
      ],
    };
  }

  // 3. Initialize MyCover Client
  const myCover = createMyCoverClient();
  if (!myCover) {
    throw new Error(
      'MyCover client could not be initialized (missing config).'
    );
  }

  // KYC is validated as required at the API boundary — never fabricate it.
  const { gender, dateOfBirth } = deviceDetails;
  if (!gender || !dateOfBirth) {
    throw new Error(
      'Insurance purchase requires policyholder gender and date_of_birth'
    );
  }

  const productId = DEFAULT_GADGET_PRODUCT_ID;
  const productConfig = MYCOVER_PRODUCTS[productId];
  const results = [];
  const [firstName = typedOrder.customer_name, ...remainingNames] =
    typedOrder.customer_name.trim().split(/\s+/);
  const lastName = remainingNames.join(' ') || firstName;

  // 4. Process insured items. We only collect ONE device's KYC/details at
  // confirmation, so we can faithfully insure a single device — cloning the
  // same serial/IMEI/photos across multiple policies would send the insurer
  // duplicate device data. Insure the first item and flag any extras.
  for (const [index, item] of insuredItems.entries()) {
    if (index > 0) {
      results.push({
        success: false,
        error:
          'Additional insured items require their own device details and were not insured.',
        itemId: item.id,
      });
      continue;
    }
    // Insured value comes from the trusted server-side order item price, never
    // the client-supplied deviceDetails.deviceValue, so a tampered confirm
    // payload can't inflate/deflate the coverage or premium basis.
    const insuredValue = Number(item.price);
    if (!(Number.isFinite(insuredValue) && insuredValue > 0)) {
      results.push({
        success: false,
        error: 'Insured item is missing a valid server-side price.',
        itemId: item.id,
      });
      continue;
    }
    try {
      const policy = await myCover.purchaseGadgetInsurance({
        product_id: productId,
        first_name: firstName,
        last_name: lastName,
        email: typedOrder.customer_email,
        phone_number: formatPhoneForMyCover(typedOrder.customer_phone),
        address: typedOrder.shipping_address?.address || 'Lagos, Nigeria',
        gender,
        date_of_birth: dateOfBirth,
        device_type: deviceDetails.deviceType,
        device_make: deviceDetails.deviceMake,
        device_model: deviceDetails.deviceModel,
        device_color: deviceDetails.deviceColor,
        serial_number: deviceDetails.serialNumber,
        device_purchase_date: deviceDetails.purchaseDate,
        image_url: deviceDetails.devicePhotos.about,
        value: insuredValue,
      });

      // 5. Save Policy to Database — premium from MyCover response (source of truth)
      const premiumAmount = Number.parseFloat(policy.amount) || 0;

      const { error: dbError } = await supabase
        .from('order_insurance_policies')
        .insert({
          order_id: typedOrder.id,
          merchant_id: typedOrder.merchant_id,
          mycover_policy_id: policy.id,
          mycover_policy_number: policy.policy_number,
          mycover_purchase_id: policy.purchase_id,
          mycover_product_id: productId,
          mycover_customer_id: policy.customer_id,
          coverage_amount: insuredValue,
          premium_amount: premiumAmount,
          status: 'active',
          policy_type: 'gadget',
          provider_name:
            productConfig?.providerName || 'Sovereign Trust Insurance Plc',
          certificate_url: policy.certificate_url,
          customer_name: typedOrder.customer_name,
          customer_email: typedOrder.customer_email,
          customer_phone: typedOrder.customer_phone,
          items_insured: {
            item_id: item.id,
            product_name: item.name,
            serial_number: deviceDetails.serialNumber,
          },
          policy_start_date: policy.start_date,
          policy_expiry_date: policy.expiration_date,
        });

      if (dbError) {
        // The policy exists at MyCover but we failed to persist it locally, so
        // the app can no longer reference it for claim/activation flows. Report
        // FAILURE (not success) — otherwise the dashboard tells the merchant
        // coverage is active while the record is lost. Log identifiers so the
        // orphaned policy can be reconciled manually.
        logger.error({
          message: 'Failed to save policy to DB',
          error: dbError,
          orderId: typedOrder.id,
          itemId: item.id,
          policyNumber: policy.policy_number,
        });
        results.push({
          success: false,
          error:
            'Policy was purchased but could not be saved locally. Manual reconciliation is required.',
          itemId: item.id,
        });
        continue;
      }

      results.push({
        success: true,
        policyNumber: policy.policy_number,
        itemId: item.id,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        message: 'MyCover Purchase Failed',
        error,
        itemId: item.id,
      });
      results.push({ success: false, error: errorMessage, itemId: item.id });
    }

    // A single assured line can carry quantity > 1 (assurance_fee is charged per
    // unit), but we only have ONE device's details, so the extra units of this
    // SKU are NOT insured — flag them so the merchant isn't told it's fully
    // active.
    const insuredUnits = Math.trunc(Number(item.quantity)) || 1;
    if (insuredUnits > 1) {
      results.push({
        success: false,
        error: `${insuredUnits - 1} additional unit(s) of this item require their own device details and were not insured.`,
        itemId: item.id,
      });
    }
  }

  return { success: true, results };
}
