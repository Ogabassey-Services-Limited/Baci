/**
 * Single Branch API Routes
 *
 * GET, PUT, DELETE operations for a specific branch.
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

const UpdateBranchSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  managerId: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/branches/[id]
 * Get a specific branch with staff accounts count
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Only fetch branches owned by this merchant
    const { data: branch, error } = await supabase
      .from('branches')
      .select(`
        *,
        staff_members:manager_id (
          id,
          full_name
        ),
        virtual_terminals (
          id,
          code,
          name,
          account_number,
          active
        )
      `)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (error || !branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error('Branch fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branch' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/branches/[id]
 * Update branch details
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const body = await request.json();
    const parseResult = UpdateBranchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, address, city, state, phone, managerId, isDefault, active } =
      parseResult.data;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (phone !== undefined) updateData.phone = phone;
    if (managerId !== undefined) updateData.manager_id = managerId;
    if (isDefault !== undefined) updateData.is_default = isDefault;
    if (active !== undefined) updateData.active = active;

    // Only allow updating branches owned by this merchant
    const { data: branch, error } = await supabase
      .from('branches')
      .update(updateData)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (error) {
      console.error('Branch update error:', error);
      return NextResponse.json(
        { error: 'Failed to update branch' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error('Branch update error:', error);
    return NextResponse.json(
      { error: 'Failed to update branch' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/branches/[id]
 * Soft delete (deactivate) a branch
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Soft delete by setting active = false (only for branches owned by this merchant)
    const { data: deletedBranch, error } = await supabase
      .from('branches')
      .update({ active: false })
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select('id')
      .single();

    if (error || !deletedBranch) {
      console.error('Branch delete error:', error);
      return NextResponse.json(
        { error: 'Branch not found or access denied' },
        { status: 404 }
      );
    }

    // Unassign virtual terminals from this branch
    const { error: terminalError } = await supabase
      .from('virtual_terminals')
      .update({ branch_id: null })
      .eq('branch_id', id)
      .eq('merchant_id', merchantId);

    if (terminalError) {
      // Log but don't fail - branch is already deleted, terminal cleanup is secondary
      console.error(
        'Failed to unassign virtual terminals from branch:',
        terminalError
      );
      return NextResponse.json({
        success: true,
        warning:
          'Branch deactivated, but terminal cleanup encountered an error',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Branch delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete branch' },
      { status: 500 }
    );
  }
}
