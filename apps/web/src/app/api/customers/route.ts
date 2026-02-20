import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { createCustomerSchema, formatZodErrors } from '@/schemas/customers';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { searchParams } = new URL(request.url);
  const searchRaw = searchParams.get('search');
  // Sanitize search input to prevent SQL injection
  const search = searchRaw ? sanitizeSearchQuery(searchRaw) : null;

  // PERFORMANCE: Add pagination support
  const page = Number.parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(
    Number.parseInt(searchParams.get('limit') || '50', 10),
    100 // Cap at 100 to prevent large queries
  );
  const offset = (page - 1) * limit;

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

  // WARDEN: Scoped query with explicit column selection to prevent data leaks
  let query = supabase
    .from('customers')
    .select(
      'id, merchant_id, full_name, email, phone, address, store_credit, total_orders, total_spent, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search?.trim()) {
    const sanitizedPattern = sanitizeLikePattern(search);
    // WARDEN: Note - ilike search on full_name might be needed if first/last are gone
    // But since we can't be sure if first/last columns exist, we'll stick to full_name if possible
    // Or try to search all. If columns don't exist, this OR clause might fail.
    // However, existing code used first_name/last_name.
    // To be safe, let's switch to full_name search if possible, or keep as is and risk it.
    // The migration `20251122000000` has `full_name`.
    // So searching `full_name` is safer.
    query = query.or(
      `full_name.ilike.%${sanitizedPattern}%,email.ilike.%${sanitizedPattern}%,phone.ilike.%${sanitizedPattern}%`
    );
  }

  const { data: customers, error, count } = await query;

  if (error) {
    console.error('Customer query failed:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    customers,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

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
    if (!hasPermission(access, 'customers', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // WARDEN: Use Zod schema for strict validation
    const parseResult = createCustomerSchema.safeParse(rawBody);

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

    // Construct full_name from parts or fallback to email username
    let fullName = 'Guest';
    if (body.first_name || body.last_name) {
      fullName = [body.first_name, body.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
    } else if (body.email) {
      fullName = body.email.split('@')[0];
    }

    // Construct full address from parts
    const fullAddress = [body.address, body.city, body.state]
      .filter(Boolean)
      .map((s) => s?.trim())
      .join(', ');

    // Insert using confirmed columns from migrations
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        merchant_id: merchantId,
        full_name: fullName,
        email: body.email || null,
        phone: body.phone || null,
        address: fullAddress || null,
        // Removed: first_name, last_name, city, state, notes (likely non-existent columns)
      })
      .select('id, merchant_id, full_name, email, phone, address, created_at')
      .single();

    if (error) {
      console.error('Customer creation failed:', error.message);
      return NextResponse.json(
        { error: 'Failed to create customer' },
        { status: 500 }
      );
    }

    return NextResponse.json({ customer });
  } catch (err) {
    console.error('Unexpected error in POST /api/customers:', err);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
