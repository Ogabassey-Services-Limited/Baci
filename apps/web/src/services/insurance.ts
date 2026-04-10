import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { createMyCoverClient, MYCOVER_PRODUCTS } from '@/lib/mycover';
import { formatPhoneForMyCover } from '@/lib/phone';
import { createClient } from '@/lib/supabase/server';

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
}

interface DatabaseOrderItem {
  id: string;
  has_assurance: boolean;
  assurance_fee?: number;
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
  deviceDetails: DeviceInsuranceDetails
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Fetch Order with Customer and Items
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, merchant_id, customer_name, customer_email, customer_phone,
      shipping_address,
      order_items (id, name, has_assurance, assurance_fee)
    `)
    .eq('id', orderId)
    .single();

  const typedOrder = order as unknown as DatabaseOrder;

  if (orderError || !typedOrder) {
    throw new Error(`Order not found: ${orderError?.message}`);
  }

  // 2. Filter for items that need assurance
  const insuredItems = typedOrder.order_items.filter(
    (item: DatabaseOrderItem) => item.has_assurance
  );

  if (insuredItems.length === 0) {
    return {
      success: false,
      message: 'No items in this order require assurance.',
    };
  }

  // 3. Initialize MyCover Client
  const myCover = createMyCoverClient();
  if (!myCover) {
    throw new Error(
      'MyCover client could not be initialized (missing config).'
    );
  }

  const productId = DEFAULT_GADGET_PRODUCT_ID;
  const productConfig = MYCOVER_PRODUCTS[productId];
  const results = [];

  // 4. Process each insured item
  for (const item of insuredItems) {
    try {
      const policy = await myCover.purchaseGadgetInsurance({
        product_id: productId,
        first_name: typedOrder.customer_name.split(' ')[0],
        last_name:
          typedOrder.customer_name.split(' ').slice(1).join(' ') || '.',
        email: typedOrder.customer_email,
        phone_number: formatPhoneForMyCover(typedOrder.customer_phone),
        address: typedOrder.shipping_address?.address || 'Lagos, Nigeria',
        gender: 'Male',
        date_of_birth: '1990-01-01',
        device_type: deviceDetails.deviceType,
        device_make: deviceDetails.deviceMake,
        device_model: deviceDetails.deviceModel,
        device_color: deviceDetails.deviceColor,
        serial_number: deviceDetails.serialNumber,
        device_purchase_date: deviceDetails.purchaseDate,
        image_url: deviceDetails.devicePhotos.about,
        value: deviceDetails.deviceValue,
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
          coverage_amount: deviceDetails.deviceValue,
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
        logger.error({
          message: 'Failed to save policy to DB',
          error: dbError,
        });
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
  }

  return { success: true, results };
}

/**
 * Sync status of pending claims from MyCover v2 API
 */
export async function syncClaimsStatus() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const myCover = createMyCoverClient();

  if (!myCover)
    return { success: false, message: 'MyCover client config missing' };

  try {
    // Fetch claims from v2 API (no type filter — match all by mycover_policy_id)
    const { claims } = await myCover.getClaims();

    let updateCount = 0;

    for (const claim of claims) {
      const policyId =
        (claim.policy as { id: string } | undefined)?.id ||
        (claim.policy_id as string | undefined);

      if (!policyId) continue;

      const { data: localPolicy } = await supabase
        .from('order_insurance_policies')
        .select('id, status, claim_status')
        .eq('mycover_policy_id', policyId)
        .single();

      if (!localPolicy) continue;

      // Map v2 claim statuses to local values
      const remoteStatus = String(
        claim.claim_status || claim.status || 'pending'
      ).toLowerCase();
      const paymentStatus = String(claim.payment_status || '').toLowerCase();

      let newClaimStatus = 'pending';

      const approvedStatuses = [
        'approved',
        'paid',
        'settled',
        'payment initiated',
      ];
      if (
        approvedStatuses.some((s) => remoteStatus.includes(s)) ||
        paymentStatus === 'paid'
      ) {
        newClaimStatus = 'approved';
      } else if (
        remoteStatus.includes('reject') ||
        remoteStatus.includes('decline')
      ) {
        newClaimStatus = 'rejected';
      } else if (
        remoteStatus.includes('submitted') ||
        remoteStatus.includes('process') ||
        remoteStatus.includes('documented') ||
        remoteStatus.includes('inspection') ||
        remoteStatus.includes('estimate') ||
        remoteStatus.includes('offer')
      ) {
        newClaimStatus = 'in_review';
      }

      if (localPolicy.claim_status !== newClaimStatus) {
        const { error: updateError } = await supabase
          .from('order_insurance_policies')
          .update({
            claim_status: newClaimStatus,
            claim_id: claim.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', localPolicy.id);

        if (updateError) {
          logger.error({
            message: '[Insurance] Failed to update claim status',
            error: updateError,
            policyId: localPolicy.id,
          });
          continue;
        }
        updateCount++;
      }
    }

    return { success: true, updated: updateCount };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    logger.error({ message: 'Claims sync failed', error });
    return { success: false, error: error.message };
  }
}
