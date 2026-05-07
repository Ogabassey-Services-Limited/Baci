import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { sanitizePhone, sanitizeText } from '@/lib/sanitize-core';
import { branchCreateSchema } from '@/schemas/branches';
import {
  BRANCH_COLUMNS,
  mapBranchMutationError,
  parseRequestedMerchantId,
} from './branch-route-utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const requestedMerchant = parseRequestedMerchantId(request);
    if (requestedMerchant.response) {
      return requestedMerchant.response;
    }

    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id,
      { requestedMerchantId: requestedMerchant.merchantId }
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { data: branches, error } = await auth.supabase
      .from('branches')
      .select(BRANCH_COLUMNS)
      .eq('merchant_id', merchantContext.merchantId)
      .eq('active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Branch list query failed:', error);
      return NextResponse.json(
        { error: 'Failed to list branches' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, branches: branches || [] });
  } catch (error) {
    console.error('Branch list error:', error);
    return NextResponse.json(
      { error: 'Failed to list branches' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const requestedMerchant = parseRequestedMerchantId(request);
    if (requestedMerchant.response) {
      return requestedMerchant.response;
    }

    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id,
      { requestedMerchantId: requestedMerchant.merchantId }
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    const parsed = branchCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { name, address, city, state, phone, managerId, isDefault } =
      parsed.data;
    const { data: branch, error } = await auth.supabase
      .from('branches')
      .insert({
        merchant_id: merchantContext.merchantId,
        name: sanitizeText(name, 120),
        address: address ? sanitizeText(address, 240) || null : null,
        city: city ? sanitizeText(city, 120) || null : null,
        state: state ? sanitizeText(state, 120) || null : null,
        phone: phone ? sanitizePhone(phone) || null : null,
        manager_id: managerId || null,
        is_default: isDefault,
      })
      .select(BRANCH_COLUMNS)
      .single();

    if (error) {
      return mapBranchMutationError(error, 'Failed to create branch');
    }

    return NextResponse.json({ success: true, branch }, { status: 201 });
  } catch (error) {
    console.error('Branch creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create branch' },
      { status: 500 }
    );
  }
}
