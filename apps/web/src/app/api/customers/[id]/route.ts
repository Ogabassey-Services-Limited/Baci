import {
  buildCustomerRecordNameFields,
  CUSTOMER_ADMIN_COLUMNS,
  normalizeCustomerType,
} from '@baci/shared';
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
    .select(CUSTOMER_ADMIN_COLUMNS)
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('Customer lookup failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  if (!customer) {
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
    const { data: existingCustomer, error: existingCustomerError } =
      await supabase
        .from('customers')
        .select(CUSTOMER_ADMIN_COLUMNS)
        .eq('id', id)
        .eq('merchant_id', merchantId)
        .maybeSingle();

    if (existingCustomerError) {
      console.error(
        'Customer lookup failed during update:',
        existingCustomerError
      );
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {
      email: body.email,
      phone: body.phone,
      address: body.address,
      store_credit: body.store_credit,
    };

    if (
      body.first_name !== undefined ||
      body.last_name !== undefined ||
      body.full_name !== undefined ||
      body.email !== undefined ||
      body.company_name !== undefined ||
      body.customer_type !== undefined
    ) {
      // Company-aware: recompute company_name/customer_type/full_name together so
      // editing a company customer updates its name (and the record stays a
      // company unless the update explicitly changes customer_type).
      const nextCustomerType = normalizeCustomerType(
        body.customer_type !== undefined
          ? body.customer_type
          : existingCustomer.customer_type
      );
      const nextCompanyName =
        body.company_name !== undefined
          ? body.company_name
          : nextCustomerType === 'company'
            ? existingCustomer.company_name
            : null;

      if (nextCustomerType === 'company' && !nextCompanyName?.trim()) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: { company_name: ['Company name is required'] },
          },
          { status: 400 }
        );
      }

      Object.assign(
        updates,
        buildCustomerRecordNameFields({
          customer_type: nextCustomerType,
          company_name: nextCompanyName,
          first_name:
            body.first_name !== undefined
              ? body.first_name
              : existingCustomer.first_name,
          last_name:
            body.last_name !== undefined
              ? body.last_name
              : existingCustomer.last_name,
          full_name:
            body.full_name !== undefined
              ? body.full_name
              : existingCustomer.full_name,
          email: body.email !== undefined ? body.email : existingCustomer.email,
        })
      );
    }

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        delete updates[key];
      }
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .eq('updated_at', existingCustomer.updated_at)
      .select(CUSTOMER_ADMIN_COLUMNS)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        {
          error:
            'Customer was updated by another request. Refresh and try again.',
        },
        { status: 409 }
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

  const { data: deletedCustomers, error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select('id');

  if (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  if (!deletedCustomers || deletedCustomers.length === 0) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
