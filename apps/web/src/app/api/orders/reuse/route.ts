import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reuseCheckoutOrderSchema } from '@/schemas/orders';

function mapReuseOrderError(
  error: { message?: string; code?: string } | null | undefined
) {
  const message = error?.message || 'Failed to reopen order';

  if (message === 'order_not_found') {
    return { status: 404, error: 'Order not found' };
  }

  if (
    message === 'unauthorized' ||
    message === 'email_mismatch' ||
    message === 'merchant_mismatch'
  ) {
    return { status: 403, error: 'Unauthorized' };
  }

  if (message === 'order_already_paid' || message === 'order_not_reusable') {
    return { status: 409, error: 'Order is no longer reusable' };
  }

  return { status: 500, error: 'Failed to reopen order' };
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = reuseCheckoutOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase.rpc(
    'prepare_storefront_order_for_checkout',
    {
      p_order_id: parsed.data.order_id,
      p_merchant_id: parsed.data.merchant_id,
      p_tracking_token: parsed.data.tracking_token,
      p_customer_email: parsed.data.customer_email,
      p_payment_method: parsed.data.payment_method,
      p_shipping_provider: parsed.data.shipping_provider || null,
      p_selected_quote_id: parsed.data.selected_quote_id || null,
    }
  );

  const order = Array.isArray(data) ? data[0] : data;

  if (error || !order) {
    const mappedError = mapReuseOrderError(error);
    return NextResponse.json(
      { error: mappedError.error },
      { status: mappedError.status }
    );
  }

  return NextResponse.json({ order });
}
