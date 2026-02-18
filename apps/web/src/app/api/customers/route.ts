import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import {
  sanitizeEmail,
  sanitizeLikePattern,
  sanitizePhone,
  sanitizeSearchQuery,
  sanitizeText,
} from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

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

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search?.trim()) {
    const sanitizedPattern = sanitizeLikePattern(search);
    query = query.or(
      `first_name.ilike.%${sanitizedPattern}%,last_name.ilike.%${sanitizedPattern}%,email.ilike.%${sanitizedPattern}%,phone.ilike.%${sanitizedPattern}%`
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
    const body = await request.json();

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

    // Explicitly whitelist allowed fields to prevent mass assignment
    const { first_name, last_name, email, phone, address, city, state, notes } =
      body;

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        first_name: first_name ? sanitizeText(first_name, 100) : null,
        last_name: last_name ? sanitizeText(last_name, 100) : null,
        email: email ? sanitizeEmail(email) : null,
        phone: phone ? sanitizePhone(phone) : null,
        address: address ? sanitizeText(address, 500) : null,
        city: city ? sanitizeText(city, 100) : null,
        state: state ? sanitizeText(state, 100) : null,
        notes: notes ? sanitizeText(notes, 1000) : null,
        merchant_id: merchantId,
      })
      .select()
      .single();

    if (error) {
      console.error('Customer creation failed:', error.message);
      return NextResponse.json(
        { error: 'Failed to create customer' },
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
