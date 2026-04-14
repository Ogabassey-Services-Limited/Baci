/**
 * Price Negotiation API
 * Allows customers to submit price offers and receive counter-offers
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// Validation schema
const NegotiationSchema = z.object({
  productId: z.string().uuid(),
  merchantId: z.string().uuid(),
  offeredPrice: z.number().positive(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  attemptNumber: z.number().min(1).max(3).default(1),
  evidenceUrl: z.string().url().optional(),
  evidenceNote: z.string().max(500).optional(),
});

// Counter-offer discount tiers
const DISCOUNT_TIERS = {
  1: 0.02, // 2% discount on first attempt
  2: 0.04, // 4% discount on second attempt
  3: 0.05, // 5% hard floor on third attempt (final offer)
};

// Minimum profit margin (don't go below this)
const MIN_PROFIT_MARGIN = 0.1; // 10%

interface NegotiationResult {
  status: 'accepted' | 'counter' | 'rejected' | 'final';
  counterOffer?: number;
  originalPrice: number;
  offeredPrice: number;
  message: string;
  attemptNumber: number;
  canContinue: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = NegotiationSchema.parse(body);

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price, cost_price, merchant_id')
      .eq('id', validatedData.productId)
      .eq('merchant_id', validatedData.merchantId)
      .eq('status', 'active')
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const originalPrice = product.price;
    const costPrice = product.cost_price || originalPrice * 0.6; // Estimate 40% margin if no cost
    const minAcceptablePrice = costPrice * (1 + MIN_PROFIT_MARGIN);

    const attemptNumber = validatedData.attemptNumber;
    const offeredPrice = validatedData.offeredPrice;

    let result: NegotiationResult;

    // Check if offered price is acceptable
    if (offeredPrice >= originalPrice) {
      // Customer offered full price or more
      result = {
        status: 'accepted',
        originalPrice,
        offeredPrice,
        message: 'Your offer has been accepted!',
        attemptNumber,
        canContinue: false,
      };
    } else if (offeredPrice >= minAcceptablePrice) {
      // Offer is within acceptable range
      result = {
        status: 'accepted',
        originalPrice,
        offeredPrice,
        message: `Great news! We can accept your offer of ₦${offeredPrice.toLocaleString()}.`,
        attemptNumber,
        canContinue: false,
      };
    } else if (attemptNumber >= 3) {
      // Final attempt - give best possible price
      const finalPrice = Math.max(
        minAcceptablePrice,
        originalPrice * (1 - DISCOUNT_TIERS[3])
      );

      if (offeredPrice >= finalPrice) {
        result = {
          status: 'accepted',
          originalPrice,
          offeredPrice,
          message: 'Your final offer has been accepted!',
          attemptNumber,
          canContinue: false,
        };
      } else {
        result = {
          status: 'final',
          counterOffer: Math.round(finalPrice),
          originalPrice,
          offeredPrice,
          message: `This is our best price: ₦${Math.round(finalPrice).toLocaleString()}. We cannot go lower.`,
          attemptNumber,
          canContinue: false,
        };
      }
    } else {
      // Generate counter-offer based on attempt
      const discountRate = DISCOUNT_TIERS[attemptNumber as 1 | 2];
      const counterOffer = Math.max(
        minAcceptablePrice,
        originalPrice * (1 - discountRate)
      );

      result = {
        status: 'counter',
        counterOffer: Math.round(counterOffer),
        originalPrice,
        offeredPrice,
        message:
          attemptNumber === 1
            ? `We appreciate your offer! How about ₦${Math.round(counterOffer).toLocaleString()}?`
            : `We've reduced our price further to ₦${Math.round(counterOffer).toLocaleString()}.`,
        attemptNumber,
        canContinue: attemptNumber < 3,
      };
    }

    // Log negotiation for analytics (non-blocking, don't fail if logging fails)
    supabase
      .from('negotiation_logs')
      .insert({
        product_id: validatedData.productId,
        merchant_id: validatedData.merchantId,
        customer_email: validatedData.customerEmail,
        customer_phone: validatedData.customerPhone,
        original_price: originalPrice,
        offered_price: offeredPrice,
        counter_offer: result.counterOffer,
        attempt_number: attemptNumber,
        status: result.status,
        evidence_url: validatedData.evidenceUrl,
        evidence_note: validatedData.evidenceNote,
      })
      .then(({ error }) => {
        if (error) console.error('Negotiation log error:', error);
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Negotiation API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process negotiation' },
      { status: 500 }
    );
  }
}
