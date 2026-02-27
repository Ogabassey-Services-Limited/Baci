import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import {
  type CheckoutItem,
  calculateCheckoutSession,
} from '@/lib/agentic/checkout';
import { createServiceClient } from '@/lib/supabase/service';

/** Zod schema for checkout item validation at API boundary */
const checkoutItemSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const checkoutItemsSchema = z.array(checkoutItemSchema).min(1);

/** Session columns accessed by this route */
const SESSION_COLUMNS =
  'id, status, currency, items, fulfillment_option_id, fulfillment_address' as const;

interface CheckoutSession {
  id: string;
  status: string;
  currency: string;
  items: unknown;
  fulfillment_option_id: string | null;
  fulfillment_address: Record<string, unknown> | null;
}

// Helper to get session from DB
async function getSession(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', id)
    .single<CheckoutSession>();
  return { data, error };
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: session, error } = await getSession(supabase, params.id);

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Validate stored items before recalculating
  const itemsResult = checkoutItemsSchema.safeParse(session.items);
  if (!itemsResult.success) {
    return NextResponse.json(
      { error: 'Invalid session items', details: itemsResult.error.flatten() },
      { status: 500 }
    );
  }

  const items: CheckoutItem[] = itemsResult.data;
  const fulfillmentOptionId = session.fulfillment_option_id;
  const currency = session.currency;

  const sessionCalc = await calculateCheckoutSession(
    supabase,
    items,
    fulfillmentOptionId,
    currency
  );

  return NextResponse.json({
    id: session.id,
    status: session.status,
    currency: currency.toLowerCase(),
    line_items: sessionCalc.lineItems,
    totals: sessionCalc.totals,
    fulfillment_options: sessionCalc.fulfillmentOptions,
    fulfillment_option_id: fulfillmentOptionId,
    fulfillment_address: session.fulfillment_address,
    messages: sessionCalc.messages,
    links: [
      { type: 'terms_of_use', url: 'https://ogabassey.com/terms' },
      { type: 'privacy_policy', url: 'https://ogabassey.com/privacy' },
    ],
  });
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { items, fulfillment_address, fulfillment_option_id } = body;

    const supabase = createServiceClient();
    const { data: session, error } = await getSession(supabase, params.id);

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Merge updates -- validate new items if provided
    let newItems: CheckoutItem[];
    if (items) {
      const itemsResult = checkoutItemsSchema.safeParse(items);
      if (!itemsResult.success) {
        return NextResponse.json(
          { error: 'Invalid items', details: itemsResult.error.flatten() },
          { status: 400 }
        );
      }
      newItems = itemsResult.data;
    } else {
      const storedResult = checkoutItemsSchema.safeParse(session.items);
      if (!storedResult.success) {
        return NextResponse.json(
          { error: 'Invalid stored session items' },
          { status: 500 }
        );
      }
      newItems = storedResult.data;
    }

    const newAddress = fulfillment_address || session.fulfillment_address;
    const newOptionId =
      fulfillment_option_id !== undefined
        ? fulfillment_option_id
        : session.fulfillment_option_id;

    // Recalculate
    const sessionCalc = await calculateCheckoutSession(
      supabase,
      newItems,
      newOptionId,
      session.currency
    );

    // Determine status
    let newStatus = 'in_progress';
    if (newAddress && sessionCalc.lineItems.length > 0) {
      newStatus = 'ready_for_payment';
    }

    // Update DB
    const { error: updateError } = await supabase
      .from('checkout_sessions')
      .update({
        items: newItems,
        fulfillment_address: newAddress,
        fulfillment_option_id: newOptionId,
        line_items: sessionCalc.lineItems,
        totals: sessionCalc.totals,
        fulfillment_options: sessionCalc.fulfillmentOptions,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update checkout session', code: 'UPDATE_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: session.id,
      status: newStatus,
      currency: session.currency.toLowerCase(),
      line_items: sessionCalc.lineItems,
      totals: sessionCalc.totals,
      fulfillment_options: sessionCalc.fulfillmentOptions,
      fulfillment_option_id: newOptionId,
      fulfillment_address: newAddress,
      messages: sessionCalc.messages,
      links: [
        { type: 'terms_of_use', url: 'https://ogabassey.com/terms' },
        { type: 'privacy_policy', url: 'https://ogabassey.com/privacy' },
      ],
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Agentic Checkout Update Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: message },
      { status: 500 }
    );
  }
}
