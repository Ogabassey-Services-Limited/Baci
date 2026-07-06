import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  enrichShippingAddressWithQuoteDestination,
  OrderQuoteDestinationMismatchError,
  type OrderShippingAddressForQuote,
} from '@/lib/shipping/order-quote-destination';
import { createClient } from '@/lib/supabase/server';
import {
  type ReuseCheckoutOrderInput,
  reuseCheckoutOrderSchema,
} from '@/schemas/orders';

type ReuseOrderQuoteItem = {
  name: string | null;
  price?: number | string | null;
  quantity: number | null;
};

type ReuseOrderQuoteValidationContext = {
  order_items: ReuseOrderQuoteItem[];
  selected_quote_id: string | null;
  shipping_address: OrderShippingAddressForQuote | undefined;
  shipping_fee: number | string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readOrderShippingAddress(
  value: unknown
): OrderShippingAddressForQuote | undefined {
  if (!isRecord(value)) return undefined;
  const address = value.address;
  const city = value.city;
  const state = value.state;
  if (
    typeof address !== 'string' ||
    typeof city !== 'string' ||
    typeof state !== 'string'
  ) {
    return undefined;
  }

  return {
    address,
    city,
    country: typeof value.country === 'string' ? value.country : undefined,
    countryCode:
      typeof value.countryCode === 'string' ? value.countryCode : undefined,
    postalCode:
      typeof value.postalCode === 'string' ? value.postalCode : undefined,
    state,
  };
}

function readOrderQuoteItem(value: unknown): ReuseOrderQuoteItem | null {
  if (!isRecord(value)) return null;
  const name = value.name;
  const quantity = value.quantity;
  const price = value.price;
  return {
    name: typeof name === 'string' ? name : null,
    price:
      typeof price === 'number' || typeof price === 'string' ? price : null,
    quantity: typeof quantity === 'number' ? quantity : null,
  };
}

function readValidationContext(
  data: unknown
): ReuseOrderQuoteValidationContext | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row)) return null;

  const shippingFee = row.shipping_fee;
  const selectedQuoteId = row.selected_quote_id;
  return {
    order_items: Array.isArray(row.order_items)
      ? row.order_items.flatMap((item) => {
          const parsed = readOrderQuoteItem(item);
          return parsed ? [parsed] : [];
        })
      : [],
    selected_quote_id:
      typeof selectedQuoteId === 'string' ? selectedQuoteId : null,
    shipping_address: readOrderShippingAddress(row.shipping_address),
    shipping_fee:
      typeof shippingFee === 'number' || typeof shippingFee === 'string'
        ? shippingFee
        : null,
  };
}

function readOptionalShippingFee(value: number | string | null): number {
  return typeof value === 'number' || typeof value === 'string'
    ? Number(value)
    : Number.NaN;
}

function mapReuseOrderError(
  error: { message?: string; code?: string } | null | undefined
) {
  const message = error?.message || 'order_not_found';

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

  if (message === 'serialized_inventory_unavailable') {
    return {
      status: 409,
      error: 'Some items in your order are out of stock',
      code: 'serialized_inventory_unavailable',
    };
  }

  if (message === 'order_already_paid' || message === 'order_not_reusable') {
    return { status: 409, error: 'Order is no longer reusable' };
  }

  return { status: 409, error: 'Order is no longer reusable' };
}

function isExpectedReuseOrderError(
  error: { message?: string; code?: string } | null | undefined
) {
  return (
    !error ||
    [
      'order_not_found',
      'unauthorized',
      'email_mismatch',
      'merchant_mismatch',
      'order_already_paid',
      'order_not_reusable',
      'serialized_inventory_unavailable',
    ].includes(error.message || '')
  );
}

function getSafeReuseOrderErrorMessage(
  error: { message?: string; code?: string } | null | undefined
) {
  return (error?.message || 'unknown')
    .replace(/https?:\/\/\S+/g, '[url]')
    .slice(0, 300);
}

async function validateSelectedQuoteForReuse(
  supabase: ReturnType<typeof createClient>,
  data: ReuseCheckoutOrderInput
): Promise<NextResponse | null> {
  const { data: validationData, error } = await supabase.rpc(
    'get_storefront_order_quote_validation_context',
    {
      p_customer_email: data.customer_email,
      p_merchant_id: data.merchant_id,
      p_order_id: data.order_id,
      p_selected_quote_id: data.selected_quote_id,
      p_tracking_token: data.tracking_token,
    }
  );

  if (error) {
    const mappedError = mapReuseOrderError(error);
    return NextResponse.json(
      {
        error: mappedError.error,
        ...(mappedError.code ? { code: mappedError.code } : {}),
      },
      { status: mappedError.status }
    );
  }

  const context = readValidationContext(validationData);
  if (!context) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const shippingFee = readOptionalShippingFee(context.shipping_fee);
  if (!context.selected_quote_id) return null;

  try {
    await enrichShippingAddressWithQuoteDestination(
      supabase,
      context.selected_quote_id,
      context.shipping_address,
      {
        items: context.order_items,
        merchantId: data.merchant_id,
        shippingFee: Number.isFinite(shippingFee) ? shippingFee : undefined,
        shippingProvider: data.shipping_provider,
      }
    );
  } catch (error) {
    if (error instanceof OrderQuoteDestinationMismatchError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(request);
  if (!csrfValid) {
    return (
      csrfResponse ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = reuseCheckoutOrderSchema.safeParse(body);

  if (!parsed.success) {
    console.warn('POST /api/orders/reuse validation failed', {
      errors: parsed.error.flatten(),
    });
    return NextResponse.json(
      { error: 'Invalid request data', code: 'validation_error' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const selectedQuoteValidationResponse = await validateSelectedQuoteForReuse(
    supabase,
    parsed.data
  );
  if (selectedQuoteValidationResponse) {
    return selectedQuoteValidationResponse;
  }

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
    if (!isExpectedReuseOrderError(error)) {
      console.warn('POST /api/orders/reuse RPC failed', {
        code: error?.code || null,
        message: getSafeReuseOrderErrorMessage(error),
        mappedStatus: mappedError.status,
      });
    }
    return NextResponse.json(
      {
        error: mappedError.error,
        ...(mappedError.code ? { code: mappedError.code } : {}),
      },
      { status: mappedError.status }
    );
  }

  return NextResponse.json({ order });
}
