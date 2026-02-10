import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { createMyCoverClient } from '@/lib/mycover';
import { createClient } from '@/lib/supabase/server';

// Default MyCover Gadget Product ID (needs to be confirmed/configurable)
// This is often specific to the distributor and insurance plan
const DEFAULT_GADGET_PRODUCT_ID =
  process.env.MYCOVER_GADGET_PRODUCT_ID || 'uuid-placeholder';

// Default MyCover GIT (Goods in Transit) Product ID
const DEFAULT_GIT_PRODUCT_ID = process.env.MYCOVER_GIT_PRODUCT_ID || undefined;

export interface DeviceInsuranceDetails {
  imei: string;
  serialNumber: string;
  deviceColor: string;
  deviceModel: string;
  deviceMake: string; // e.g. "Apple"
  deviceType: 'Phone' | 'Laptop' | 'Others';
  deviceValue: number;
  purchaseDate: string; // YYYY-MM-DD
  devicePhotos: {
    about: string; // URL
  };
  customerPhoto?: string; // Optional (or placeholder) ID URL
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
  customer_phone: string; // Fixed: customer_phone IS string in DB usually
  shipping_address?: {
    address?: string;
    [key: string]: unknown;
  };
  order_items: DatabaseOrderItem[];
  [key: string]: unknown;
}

interface MyCoverClaim {
  id: string;
  policy?: { id: string };
  policy_id?: string;
  claim_status?: string;
  status?: string;
  payment_status?: string;
  [key: string]: unknown;
}

/**
 * Purchase gadget insurance for a confirmed order
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
      *,
      order_items (*)
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

  const results = [];

  // 4. Process each insured item (currently assuming 1 device per confirm action for simplicity,
  // but loop handles multiple if they share same device details - edge case)
  for (const item of insuredItems) {
    try {
      // Construct payload
      // Use placeholder for ID image if not provided (negotiated/MVP flow)
      const idImageUrl =
        deviceDetails.customerPhoto ||
        'https://via.placeholder.com/300x200?text=Customer+ID';

      const policy = await myCover.purchaseGadgetInsurance({
        // Customer Info
        first_name: typedOrder.customer_name.split(' ')[0],
        last_name:
          typedOrder.customer_name.split(' ').slice(1).join(' ') || '.',
        email: typedOrder.customer_email,
        phone_number: typedOrder.customer_phone,
        address: typedOrder.shipping_address?.address || 'Lagos, Nigeria', // Fallback
        gender: 'Male', // Default/Placeholder as we don't collect gender
        date_of_birth: '1990-01-01', // Default/Placeholder as we don't collect DOB
        occupation: 'Professional', // Default
        title: 'Mr/Mrs', // Default

        // Device Info
        product_id: DEFAULT_GADGET_PRODUCT_ID,
        model_number: deviceDetails.deviceModel, // Often same as model name
        device_type: deviceDetails.deviceType,
        device_make: deviceDetails.deviceMake,
        device_model: deviceDetails.deviceModel,
        device_color: deviceDetails.deviceColor,
        imei_one: deviceDetails.imei,
        date_of_purchase: deviceDetails.purchaseDate,
        device_value: deviceDetails.deviceValue,
        device_serial_number: deviceDetails.serialNumber,

        // Images
        device_about_image_url: deviceDetails.devicePhotos.about,
        id_image_url: idImageUrl,
      });

      // 5. Save Policy to Database
      const { error: dbError } = await supabase
        .from('order_insurance_policies')
        .insert({
          order_id: typedOrder.id,
          merchant_id: typedOrder.merchant_id,
          mycover_policy_id: policy.id,
          mycover_policy_number: policy.policy_number,
          mycover_purchase_id: policy.purchase_id,
          coverage_amount: deviceDetails.deviceValue,
          premium_amount: item.assurance_fee || 0,
          status: 'active',
          customer_name: typedOrder.customer_name,
          customer_email: typedOrder.customer_email,
          customer_phone: typedOrder.customer_phone,
          items_insured: {
            item_id: item.id,
            product_name: item.name,
            imei: deviceDetails.imei,
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
 * Auto-purchase shipping insurance (Goods in Transit) for a paid order.
 * Called from payment webhooks via after() when an order transitions to "paid".
 *
 * This uses GIT (Goods in Transit) insurance which only requires
 * customer + shipping details (no device IMEI/serial needed).
 */
export async function purchaseInsuranceForPaidOrder(
  supabase: SupabaseClient,
  orderId: string,
  merchantId: string
): Promise<void> {
  // 1. Initialize MyCover client — skip gracefully if not configured
  const myCover = createMyCoverClient();
  if (!myCover) {
    logger.warn({
      message: '[Insurance] MyCover not configured, skipping auto-purchase',
      orderId,
    });
    return;
  }

  // 2. Fetch order with items that have assurance
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      `
      id,
      merchant_id,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      order_items (
        id,
        name,
        price,
        quantity,
        has_assurance,
        assurance_fee
      )
    `
    )
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    logger.error({
      message: '[Insurance] Failed to fetch order for insurance purchase',
      orderId,
      error: orderError,
    });
    return;
  }

  // 3. Filter items with assurance enabled
  const insuredItems = (
    order.order_items as DatabaseOrderItem[] | null
  )?.filter((item) => item.has_assurance);

  if (!insuredItems || insuredItems.length === 0) {
    return; // No insured items — nothing to do
  }

  // 4. Idempotency: check if policy already exists for this order
  const { data: existingPolicy } = await supabase
    .from('order_insurance_policies')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existingPolicy) {
    logger.info({
      message: '[Insurance] Policy already exists for order, skipping',
      orderId,
    });
    return;
  }

  // 5. Build purchase params from order data
  const nameParts = (order.customer_name || 'Customer').split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '.';

  const shippingAddr = order.shipping_address as {
    address?: string;
    city?: string;
    state?: string;
  } | null;

  const deliveryAddress =
    [shippingAddr?.address, shippingAddr?.city, shippingAddr?.state]
      .filter(Boolean)
      .join(', ') || 'Nigeria';

  // Calculate total value of insured items
  const totalInsuredValue = insuredItems.reduce(
    (sum, item) =>
      sum + (item.price as number) * ((item.quantity as number) || 1),
    0
  );

  const totalAssuranceFee = insuredItems.reduce(
    (sum, item) => sum + ((item.assurance_fee as number) || 0),
    0
  );

  const itemDetails = insuredItems.map((item) => ({
    description: item.name as string,
    value: (item.price as number) * ((item.quantity as number) || 1),
    quantity: (item.quantity as number) || 1,
  }));

  try {
    const policy = await myCover.purchaseShippingInsurance({
      first_name: firstName,
      last_name: lastName,
      email: order.customer_email || '',
      phone_number: order.customer_phone || '',
      address: deliveryAddress,
      pickup_location: 'Lagos, Nigeria', // Merchant warehouse (default)
      drop_off_location: deliveryAddress,
      shipping_date: new Date().toISOString().split('T')[0],
      vehicle_type: 'Car',
      item_value: totalInsuredValue,
      item_details: itemDetails,
      ...(DEFAULT_GIT_PRODUCT_ID && { product_id: DEFAULT_GIT_PRODUCT_ID }),
    });

    // 6. Save policy to database
    const { error: dbError } = await supabase
      .from('order_insurance_policies')
      .insert({
        order_id: orderId,
        merchant_id: merchantId,
        mycover_policy_id: policy.id,
        mycover_policy_number: policy.policy_number,
        mycover_purchase_id: policy.purchase_id,
        coverage_amount: totalInsuredValue,
        premium_amount: totalAssuranceFee,
        status: 'active',
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        shipping_address: shippingAddr,
        items_insured: itemDetails,
        policy_start_date: policy.start_date,
        policy_expiry_date: policy.expiration_date,
      });

    if (dbError) {
      logger.error({
        message: '[Insurance] Policy purchased but failed to save to DB',
        orderId,
        policyId: policy.id,
        error: dbError,
      });
      return;
    }

    logger.info({
      message: '[Insurance] Shipping insurance purchased successfully',
      orderId,
      policyNumber: policy.policy_number,
      premium: policy.genius_price,
      coverage: totalInsuredValue,
    });
  } catch (error) {
    logger.error({
      message: '[Insurance] Failed to purchase shipping insurance',
      orderId,
      error,
    });
    // Do NOT rethrow — this runs in after(), failure should not affect payment
  }
}

/**
 * Sync status of pending claims from MyCover API
 */
export async function syncClaimsStatus() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const myCover = createMyCoverClient();

  if (!myCover)
    return { success: false, message: 'MyCover client config missing' };

  try {
    // 1. Fetch recent claims from MyCover
    // The SDK returns all claims. In a real app with thousands, we'd want pagination.
    const claims = await myCover.getClaims();

    // 2. Map claims to local policies by Policy Number or ID
    // MyCover claim object typically includes 'policy_number' or related identifiers

    let updateCount = 0;

    for (const claim of claims as MyCoverClaim[]) {
      // We need to match this claim to our local DB
      // Typically via policy ID
      const policyId = claim.policy?.id || claim.policy_id;

      if (policyId) {
        // Find local policy
        const { data: localPolicy } = await supabase
          .from('order_insurance_policies')
          .select('id, status, claim_status')
          .eq('mycover_policy_id', policyId)
          .single();

        if (localPolicy) {
          // Update the status
          // Map MyCover status (e.g., 'Approved', 'Paid', 'Pending') to our local ENUM
          // Real API returns 'claim_status' e.g., 'Repair estimate submitted', 'Paid', etc.
          const remoteStatus = String(
            claim.claim_status || claim.status || 'pending'
          ).toLowerCase();
          const paymentStatus = String(
            claim.payment_status || ''
          ).toLowerCase(); // sometimes 'paid'

          let newClaimStatus = 'pending';

          if (
            remoteStatus.includes('approved') ||
            remoteStatus.includes('paid') ||
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
            remoteStatus.includes('process')
          ) {
            newClaimStatus = 'in_review';
          }

          // We only update if changed, and we map 'in_review' back to 'pending' if our DB enum is strict
          // Assuming DB column `claim_status` allows these values or is text.
          // If strict enum, might need adjustment. For now assume text or loosely coupled.

          if (localPolicy.claim_status !== newClaimStatus) {
            await supabase
              .from('order_insurance_policies')
              .update({
                claim_status: newClaimStatus,
                claim_id: claim.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', localPolicy.id);
            updateCount++;
          }
        }
      }
    }

    return { success: true, updated: updateCount };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    logger.error({ message: 'Claims sync failed', error });
    return { success: false, error: error.message };
  }
}
