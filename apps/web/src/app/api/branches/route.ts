/**
 * Branch Management API Routes
 *
 * CRUD operations for merchant branches (store locations).
 * Branches group Staff Accounts for location-based tracking.
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateBranchSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  managerId: z.string().uuid().optional(),
  isDefault: z.boolean().optional().default(false),
});

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * GET /api/branches
 * List all branches for the merchant
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;

    const { data: branches } = await supabase
      .from('branches')
      .select(`
        id,
        name,
        address,
        city,
        state,
        phone,
        is_default,
        active,
        created_at,
        manager_id,
        staff_members:manager_id (
          id,
          full_name
        )
      `)
      .eq('merchant_id', merchantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    return NextResponse.json({ success: true, branches: branches || [] });
  } catch (error) {
    console.error('Branch list error:', error);
    return NextResponse.json(
      { error: 'Failed to list branches' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/branches
 * Create a new branch
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;

    // Parse and validate request body
    const body = await request.json();
    const parseResult = CreateBranchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, address, city, state, phone, managerId, isDefault } =
      parseResult.data;

    // Create branch
    const { data: branch, error } = await supabase
      .from('branches')
      .insert({
        merchant_id: merchantId,
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        phone: phone || null,
        manager_id: managerId || null,
        is_default: isDefault,
      })
      .select()
      .single();

    if (error) {
      console.error('Branch creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create branch' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error('Branch creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create branch' },
      { status: 500 }
    );
  }
}
