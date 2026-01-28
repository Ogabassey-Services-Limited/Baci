/**
 * Branch Management API Routes
 *
 * CRUD operations for merchant branches (store locations).
 * Branches group Staff Accounts for location-based tracking.
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      // Check if user is staff
      const { data: staffMember } = await supabase
        .from('staff_members')
        .select('merchant_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!staffMember) {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
      }

      // Staff - list branches for their merchant
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
        .eq('merchant_id', staffMember.merchant_id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      return NextResponse.json({ success: true, branches: branches || [] });
    }

    // Merchant owner
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
      .eq('merchant_id', merchant.id)
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

    // Get merchant
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
        merchant_id: merchant.id,
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
