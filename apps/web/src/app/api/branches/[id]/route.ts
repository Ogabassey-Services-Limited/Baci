import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { toUserAccess } from '@/lib/get-merchant-for-api-request';
import { sanitizePhone, sanitizeText } from '@/lib/sanitize-core';
import { branchIdParamSchema, branchUpdateSchema } from '@/schemas/branches';
import {
  authenticateAndResolveMerchant,
  BRANCH_COLUMNS,
  BRANCH_DETAIL_COLUMNS,
  mapBranchMutationError,
} from '../branch-route-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await authenticateAndResolveMerchant(request);
    if (authContext.response) {
      return authContext.response;
    }
    if (!authContext.supabase || !authContext.merchantContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsedParams = branchIdParamSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid branch id' }, { status: 400 });
    }

    const { data: branch, error } = await authContext.supabase
      .from('branches')
      .select(BRANCH_DETAIL_COLUMNS)
      .eq('id', parsedParams.data.id)
      .eq('merchant_id', authContext.merchantContext.merchantId)
      .eq('active', true)
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

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await authenticateAndResolveMerchant(request);
    if (authContext.response) {
      return authContext.response;
    }
    if (!authContext.supabase || !authContext.merchantContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const parsedParams = branchIdParamSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid branch id' }, { status: 400 });
    }

    const access = toUserAccess(authContext.merchantContext);
    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    const parsed = branchUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const updateData: Record<string, string | boolean | null> = {};
    if (parsed.data.name !== undefined) {
      updateData.name = sanitizeText(parsed.data.name, 120);
    }
    if (parsed.data.address !== undefined) {
      updateData.address = parsed.data.address
        ? sanitizeText(parsed.data.address, 240) || null
        : null;
    }
    if (parsed.data.city !== undefined) {
      updateData.city = parsed.data.city
        ? sanitizeText(parsed.data.city, 120) || null
        : null;
    }
    if (parsed.data.state !== undefined) {
      updateData.state = parsed.data.state
        ? sanitizeText(parsed.data.state, 120) || null
        : null;
    }
    if (parsed.data.phone !== undefined) {
      updateData.phone = parsed.data.phone
        ? sanitizePhone(parsed.data.phone) || null
        : null;
    }
    if (parsed.data.managerId !== undefined) {
      updateData.manager_id = parsed.data.managerId;
    }
    if (parsed.data.isDefault !== undefined) {
      updateData.is_default = parsed.data.isDefault;
    }

    const { data: branch, error } = await authContext.supabase
      .from('branches')
      .update(updateData)
      .eq('id', parsedParams.data.id)
      .eq('merchant_id', authContext.merchantContext.merchantId)
      .eq('active', true)
      .select(BRANCH_COLUMNS)
      .single();

    if (error) {
      return mapBranchMutationError(error, 'Failed to update branch');
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await authenticateAndResolveMerchant(request);
    if (authContext.response) {
      return authContext.response;
    }
    if (!authContext.supabase || !authContext.merchantContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const parsedParams = branchIdParamSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid branch id' }, { status: 400 });
    }

    const access = toUserAccess(authContext.merchantContext);
    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: branch, error: branchLookupError } =
      await authContext.supabase
        .from('branches')
        .select('id')
        .eq('id', parsedParams.data.id)
        .eq('merchant_id', authContext.merchantContext.merchantId)
        .eq('active', true)
        .single();

    if (branchLookupError || !branch) {
      return mapBranchMutationError(
        branchLookupError ?? { code: 'PGRST116', message: 'Branch not found' },
        'Failed to deactivate branch'
      );
    }

    const { error } = await authContext.supabase.rpc('deactivate_branch', {
      p_branch_id: parsedParams.data.id,
    });

    if (error) {
      return mapBranchMutationError(error, 'Failed to deactivate branch');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Branch delete error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate branch' },
      { status: 500 }
    );
  }
}
