'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { topshipProvider } from '@/lib/shipping/providers/topship';
import { createClient } from '@/lib/supabase/server';
import {
  type RepairBookingInput,
  repairBookingSchema,
} from '@/lib/validations/repair';

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
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Validate input
  const validationResult = repairBookingSchema.safeParse(data);
  if (!validationResult.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: validationResult.error.flatten().fieldErrors,
    };
  }

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
    const repairId = globalThis.crypto.randomUUID();

    // 2. Insert into database
    const { error } = await supabase.from('repairs').insert({
      id: repairId,
      merchant_id: merchantId,
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

    // 3. Revalidate paths (optional, if we show recent requests somewhere)
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
  try {
    // 1. Check if Lagos (Free Pickup)
    const isLagos =
      place.state?.toLowerCase().includes('lagos') ||
      place.city?.toLowerCase().includes('lagos') ||
      place.formattedAddress?.toLowerCase().includes('lagos');

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
        address: place.formattedAddress,
        city: place.city || place.state,
        state: place.state,
        country: place.country || 'Nigeria',
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
