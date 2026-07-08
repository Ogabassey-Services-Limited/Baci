'use server';

import { revalidatePath } from 'next/cache';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import {
  type CreateRepairResult,
  createRepairBooking,
} from '@/lib/repairs/create-repair-core';
import { topshipProvider } from '@/lib/shipping/providers/topship';
import type { RepairBookingInput } from '@/lib/validations/repair';
import { repairPlaceDetailsSchema } from '@/schemas/repair-actions';

export type { CreateRepairResult };

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

// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: anonymous repair booking; Zod-validated + identity/IP rate limited, write goes through the SECURITY DEFINER booking RPC
export async function createRepair(
  data: RepairBookingInput,
  merchantId: string
): Promise<CreateRepairResult> {
  // Shared core: app-layer rate limit + Zod validation + booking RPC (which
  // re-validates the merchant/active quote and snapshots the price server-side).
  const result = await createRepairBooking(data, merchantId);

  if (result.success) {
    // Revalidate the merchant bookings surface (built in a later phase).
    revalidatePath('/dashboard/repairs');
  }

  return result;
}

// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: anonymous shipping quote; address completeness enforced by Zod + identity/IP rate limited
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
