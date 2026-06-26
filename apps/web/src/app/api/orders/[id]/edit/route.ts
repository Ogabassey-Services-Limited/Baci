import { MOBILE_ADMIN_ORDER_COLUMNS } from '@baci/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { adminOrderEditSchema } from '@/schemas/admin-order-edit';

const paramsSchema = z.object({
  id: z.uuid(),
});

const updatedOrderSelect = `${MOBILE_ADMIN_ORDER_COLUMNS}, order_items(id, product_id, condition, has_assurance, image_url, item_description, product_match_status, variant_id, variant_name, variant_attributes, name, quantity, price)`;

interface OrderEditRpcResult {
  change_category?: string;
  changed_fields?: string[];
  customer_email?: string | null;
  merchant_id?: string;
  notify_customer?: boolean;
  order_id?: string;
}

function mapOrderEditError(error: { code?: string; message?: string }) {
  const message = error.message ?? 'Failed to update order';

  if (message.includes('order_not_found')) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (
    message.includes('order_item_product_forbidden') ||
    message.includes('order_item_variant_forbidden')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (message.includes('order_edit_forbidden') || error.code === '42501') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (
    message.includes('order_financial_edit_has_payments') ||
    message.includes('order_financial_edit_after_fulfillment') ||
    message.includes('order_terminal_not_editable') ||
    message.includes('order_item_replacement_has_historical_state') ||
    message.includes(
      'cannot_delete_order_item_with_historical_serialized_units'
    ) ||
    message.includes(
      'cannot_delete_order_item_with_historical_inventory_events'
    )
  ) {
    return NextResponse.json(
      {
        code: 'order_not_editable',
        error:
          'This order has payments or fulfillment history. Financial edits are locked.',
      },
      { status: 409 }
    );
  }

  if (message.includes('order_total_negative')) {
    return NextResponse.json(
      { error: 'Discount cannot exceed the order total' },
      { status: 400 }
    );
  }

  if (
    message.includes('branch_not_found') ||
    message.includes('customer_not_found') ||
    message.includes('branch_id_invalid') ||
    message.includes('customer_id_invalid') ||
    message.includes('order_required_fields_invalid') ||
    message.includes('order_notify_customer_invalid') ||
    message.includes('order_money_invalid') ||
    message.includes('order_item_values_invalid') ||
    message.includes('order_item_product_invalid') ||
    message.includes('order_item_variant_invalid') ||
    message.includes('order_item_product_required')
  ) {
    return NextResponse.json({ error: 'Invalid order scope' }, { status: 400 });
  }

  return NextResponse.json(
    { error: 'Failed to update order' },
    { status: 500 }
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = auth.supabase;

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const paramsResult = paramsSchema.safeParse(await context.params);
  if (!paramsResult.success) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = adminOrderEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: z.flattenError(parsed.error) },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc('update_admin_order', {
    p_order_id: paramsResult.data.id,
    p_payload: parsed.data,
  });

  if (error) {
    return mapOrderEditError(error);
  }

  const result = data as OrderEditRpcResult;

  const { data: updatedOrder, error: updatedOrderError } = await supabase
    .from('orders')
    .select(updatedOrderSelect)
    .eq('id', paramsResult.data.id)
    .eq('merchant_id', result.merchant_id ?? '')
    .single();

  if (updatedOrderError || !updatedOrder) {
    return NextResponse.json(
      { error: 'Order updated but refresh failed' },
      { status: 500 }
    );
  }

  const normalizedOrder = updatedOrder as Record<string, unknown> & {
    order_items?: unknown[];
  };
  const { order_items: orderItems, ...orderFields } = normalizedOrder;

  return NextResponse.json({
    edit: data,
    order: {
      ...orderFields,
      items: orderItems ?? [],
    },
  });
}
