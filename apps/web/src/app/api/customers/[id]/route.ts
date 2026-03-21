import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { formatZodErrors, updateCustomerSchema } from '@/schemas/customers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get merchant context (supports both owners and staff members)
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }
  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'customers', 'view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const merchantId = merchantContext.merchantId;

  const { data: customer, error } = await supabase
    .from('customers')
    .select(
      'id, merchant_id, full_name, email, phone, address, store_credit, total_orders, total_spent, created_at, updated_at'
    )
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({ customer });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF protection
  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(request as NextRequest);
  if (!csrfValid) {
    return (
      csrfResponse ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const id = (await params).id;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    const rawBody = await request.json();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant context (supports both owners and staff members)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'customers', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    const parseResult = updateCustomerSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodErrors(parseResult.error),
        },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    const { data: customer, error } = await supabase
      .from('customers')
      .update(body)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select(
        'id, merchant_id, full_name, email, phone, address, store_credit, total_orders, total_spent, created_at, updated_at'
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF protection
  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(_request as NextRequest);
  if (!csrfValid) {
    return (
      csrfResponse ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const id = (await params).id;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get merchant context (supports both owners and staff members)
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }
  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'customers', 'delete')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const merchantId = merchantContext.merchantId;

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId);

  if (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
