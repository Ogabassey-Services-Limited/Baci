'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { topshipProvider } from '@/lib/shipping/providers/topship';
import { createClient } from '@/lib/supabase/server';
import {
  type RepairBookingInput,
  repairBookingSchema,
} from '@/lib/validations/repair';
import {
  repairMerchantIdSchema,
  repairPlaceDetailsSchema,
} from '@/schemas/repair-actions';

interface PlaceDetails {
  streetNumber: string;
  route: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  formattedAddress: string;
}

export type ShippingCalculationResult = {
  isFree: boolean;
  price: number;
  formattedPrice: string;
  error?: string;
  message?: string;
};

export type CreateRepairResult =
  | { success: true; id: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createRepair(
  data: RepairBookingInput,
  merchantId: string
): Promise<CreateRepairResult> {
  // 1. Rate limit first — anonymous customers book repairs, so this action
  // cannot require a login; abuse control happens per user/IP instead.
  const allowed = await ensureActionRateLimit('repair-create', {
    requests: 5,
    windowMs: 60_000,
  });
  if (!allowed) {
    return {
      success: false,
      error: 'Too many repair requests. Please try again in a minute.',
    };
  }

  // 2. Validate inputs
  const parsedMerchantId = repairMerchantIdSchema.safeParse(merchantId);
  if (!parsedMerchantId.success) {
    return { success: false, error: 'Invalid store reference.' };
  }

  const validationResult = repairBookingSchema.safeParse(data);
  if (!validationResult.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: validationResult.error.flatten().fieldErrors,
    };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    customerName,
    customerEmail,
    customerPhone,
    deviceType,
    deviceModel,
    issueDescription,
    preferredDate,
    serviceType,
    pickupAddress,
  } = validationResult.data;

  try {
    // 3. Verify the target store exists so anonymous submissions stay
    // scoped to a real merchant.
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', parsedMerchantId.data)
      .maybeSingle();

    if (merchantError || !merchant) {
      return { success: false, error: 'Store not found.' };
    }

    const repairId = globalThis.crypto.randomUUID();

    // 4. Insert into database
    const { error } = await supabase.from('repairs').insert({
      id: repairId,
      merchant_id: merchant.id,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      device_type: deviceType,
      device_model: deviceModel,
      issue_description: issueDescription,
      preferred_date: preferredDate
        ? new Date(preferredDate).toISOString()
        : null,
      service_type: serviceType,
      pickup_address: pickupAddress || null,
      status: 'pending',
    });

    if (error) {
      console.error('Error creating repair:', error);
      return {
        success: false,
        error: 'Failed to submit repair request. Please try again.',
      };
    }

    // 5. Revalidate paths (optional, if we show recent requests somewhere)
    revalidatePath('/dashboard/repairs');

    return { success: true, id: repairId };
  } catch (error) {
    console.error('Unexpected error creating repair:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function calculateRepairShipping(
  place: PlaceDetails
): Promise<ShippingCalculationResult> {
  // Rate limit first — this fans out to the paid Topship quoting API and is
  // callable by anonymous storefront customers.
  const allowed = await ensureActionRateLimit('repair-shipping', {
    requests: 10,
    windowMs: 60_000,
  });
  if (!allowed) {
    return {
      isFree: false,
      price: 0,
      formattedPrice: 'Calculated at confirmation',
      error: 'Too many shipping estimates. Please try again shortly.',
    };
  }

  const parsedPlace = repairPlaceDetailsSchema.safeParse(place);
  if (!parsedPlace.success) {
    return {
      isFree: false,
      price: 0,
      formattedPrice: 'Calculated at confirmation',
      error: 'Invalid address details',
    };
  }

  const placeDetails = parsedPlace.data;

  try {
    // 1. Check if Lagos (Free Pickup)
    const isLagos =
      placeDetails.state.toLowerCase().includes('lagos') ||
      placeDetails.city.toLowerCase().includes('lagos') ||
      placeDetails.formattedAddress.toLowerCase().includes('lagos');

    if (isLagos) {
      return {
        isFree: true,
        price: 0,
        formattedPrice: 'Free',
        message: 'Free pickup available in Lagos!',
      };
    }

    // 2. Calculate via Topship for other locations
    const ogabasseyLocation = {
      name: 'Ogabassey Repair Center',
      phone: '09070007000',
      email: 'repairs@ogabassey.com',
      address: '3, Olayeni Street, Computer Village',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'Nigeria',
      countryCode: 'NG',
    };

    const quotes = await topshipProvider.getQuotes({
      sessionId: `repair-${Date.now()}`,
      shipmentType: 'domestic',
      items: [
        {
          name: 'Device for Repair',
          quantity: 1,
          weight: 1,
          value: 50000,
          category: 'gadgets',
        },
      ],
      receiver: ogabasseyLocation,
      sender: {
        name: 'Customer',
        phone: '0000000000',
        address: placeDetails.formattedAddress,
        city: placeDetails.city || placeDetails.state,
        state: placeDetails.state,
        country: placeDetails.country || 'Nigeria',
        countryCode: 'NG',
      },
    });

    if (!quotes || quotes.length === 0) {
      return {
        isFree: false,
        price: 0,
        formattedPrice: 'Calculated at confirmation',
        error: 'Could not fetch real-time rates',
      };
    }

    const validQuotes = quotes
      .filter((q) => q.price > 0)
      .sort((a, b) => a.price - b.price);

    if (validQuotes.length === 0) {
      return {
        isFree: false,
        price: 0,
        formattedPrice: 'Calculated at confirmation',
        error: 'No valid rates found',
      };
    }

    const cheapest = validQuotes[0];

    return {
      isFree: false,
      price: cheapest.price,
      formattedPrice: `₦${cheapest.price.toLocaleString()}`,
      message: `Estimated pickup fee: ₦${cheapest.price.toLocaleString()}`,
    };
  } catch (error) {
    console.error('Error calculating shipping:', error);
    return {
      isFree: false,
      price: 0,
      formattedPrice: 'Calculated at confirmation',
      error: 'Failed to calculate shipping',
    };
  }
}
