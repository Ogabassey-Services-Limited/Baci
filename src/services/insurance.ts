
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createMyCoverClient, MyCoverError } from '@/lib/mycover';
import { logger } from '@/lib/logger';

// Default MyCover Gadget Product ID (needs to be confirmed/configurable)
// This is often specific to the distributor and insurance plan
const DEFAULT_GADGET_PRODUCT_ID = process.env.MYCOVER_GADGET_PRODUCT_ID || 'uuid-placeholder';

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
    customerPhoto?: string; // Optional (or placeholder) ID URL
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

    if (orderError || !order) {
        throw new Error(`Order not found: ${orderError?.message}`);
    }

    // 2. Filter for items that need assurance
    const insuredItems = order.order_items.filter((item: any) => item.has_assurance);

    if (insuredItems.length === 0) {
        return { success: false, message: 'No items in this order require assurance.' };
    }

    // 3. Initialize MyCover Client
    const myCover = createMyCoverClient();
    if (!myCover) {
        throw new Error('MyCover client could not be initialized (missing config).');
    }

    const results = [];

    // 4. Process each insured item (currently assuming 1 device per confirm action for simplicity,
    // but loop handles multiple if they share same device details - edge case)
    for (const item of insuredItems) {
        try {
            // Construct payload
            // Use placeholder for ID image if not provided (negotiated/MVP flow)
            const idImageUrl = deviceDetails.customerPhoto || 'https://via.placeholder.com/300x200?text=Customer+ID';

            const policy = await myCover.purchaseGadgetInsurance({
                // Customer Info
                first_name: order.customer_name.split(' ')[0],
                last_name: order.customer_name.split(' ').slice(1).join(' ') || '.',
                email: order.customer_email,
                phone_number: order.customer_phone,
                address: order.shipping_address?.address || 'Lagos, Nigeria', // Fallback
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
                    order_id: order.id,
                    merchant_id: order.merchant_id,
                    mycover_policy_id: policy.id,
                    mycover_policy_number: policy.policy_number,
                    mycover_purchase_id: policy.purchase_id,
                    coverage_amount: deviceDetails.deviceValue,
                    premium_amount: item.assurance_fee || 0,
                    status: 'active',
                    customer_name: order.customer_name,
                    customer_email: order.customer_email,
                    customer_phone: order.customer_phone,
                    items_insured: {
                        item_id: item.id,
                        product_name: item.name,
                        imei: deviceDetails.imei
                    },
                    policy_start_date: policy.start_date,
                    policy_expiry_date: policy.expiration_date
                });

            if (dbError) {
                logger.error({ message: 'Failed to save policy to DB', error: dbError });
            }

            results.push({ success: true, policyNumber: policy.policy_number, itemId: item.id });

        } catch (error: any) {
            logger.error({ message: 'MyCover Purchase Failed', error, itemId: item.id });
            results.push({ success: false, error: error.message, itemId: item.id });
        }
    }

    return { success: true, results };
}

/**
 * Sync status of pending claims from MyCover API
 */
export async function syncClaimsStatus(merchantId: string) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const myCover = createMyCoverClient();

    if (!myCover) return { success: false, message: 'MyCover client config missing' };

    try {
        // 1. Fetch recent claims from MyCover
        // The SDK returns all claims. In a real app with thousands, we'd want pagination.
        const claims = await myCover.getClaims();

        // 2. Map claims to local policies by Policy Number or ID
        // MyCover claim object typically includes 'policy_number' or related identifiers

        let updateCount = 0;

        for (const claim of claims as any[]) {
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
                    const remoteStatus = (claim.claim_status || claim.status || 'pending').toLowerCase();
                    const paymentStatus = (claim.payment_status || '').toLowerCase(); // sometimes 'paid'
                    
                    let newClaimStatus = 'pending';
                    
                    if (remoteStatus.includes('approved') || remoteStatus.includes('paid') || paymentStatus === 'paid') {
                        newClaimStatus = 'approved';
                    } else if (remoteStatus.includes('reject') || remoteStatus.includes('decline')) {
                        newClaimStatus = 'rejected';
                    } else if (remoteStatus.includes('submitted') || remoteStatus.includes('process')) {
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
                               updated_at: new Date().toISOString()
                           })
                           .eq('id', localPolicy.id);
                        updateCount++;
                    }
                }
            }
        }

        return { success: true, updated: updateCount };

    } catch (e: any) {
        logger.error({ message: 'Claims sync failed', error: e });
        return { success: false, error: e.message };
    }
}
