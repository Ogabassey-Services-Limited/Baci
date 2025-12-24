import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
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

  // Get merchant_id
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!merchant) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('merchant_id', merchant.id)
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
    return NextResponse.json({ error: error.message }, { status: 500 });
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

export async function POST(request: Request) {
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

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

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
        merchant_id: merchant.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer });
  } catch (_) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
