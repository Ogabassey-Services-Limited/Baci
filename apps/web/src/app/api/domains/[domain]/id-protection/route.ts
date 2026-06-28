import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { logAudit } from '@/lib/audit-logger';
import { checkCsrfProtection } from '@/lib/csrf';
import { getDomainIDProtection, updateDomainIDProtection } from '@/lib/go54';
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';
import { checkRateLimit } from '@/lib/rate-limiter';

/**
 * GET /api/domains/[domain]/id-protection
 * Get ID protection status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const auth = await authenticateApiRequest(request);

    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, supabase } = auth;
    const access = await getUserAccess(supabase);

    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'settings', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      access.merchantId,
      'custom_domain'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

    // Rate Limiting
    const isAllowed = await checkRateLimit(
      supabase,
      user.id,
      'id_protection_read',
      100,
      1
    );
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Verify domain ownership through merchant access context
    const { data: domainData, error: domainError } = await supabase
      .from('domains')
      .select('id, domain, merchant_id')
      .eq('domain', domain)
      .eq('merchant_id', access.merchantId)
      .single();

    if (domainError || !domainData) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 404 }
      );
    }

    // Get ID protection status from Go54
    const status = await getDomainIDProtection(domain);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching ID protection status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ID protection status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains/[domain]/id-protection
 * Enable or disable ID protection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  // CSRF protection
  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(request);
  if (!csrfValid) {
    return (
      csrfResponse ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  let userId: string | null = null;
  let domainData: { merchant_id: string } | null = null;
  let supabase: SupabaseClient | null = null;
  const { domain } = await params;

  try {
    const auth = await authenticateApiRequest(request);

    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    userId = auth.user.id;
    supabase = auth.supabase;

    const access = await getUserAccess(supabase);

    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      access.merchantId,
      'custom_domain'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

    // Rate Limiting
    const isAllowed = await checkRateLimit(
      supabase,
      userId,
      'id_protection_update',
      10,
      1
    );
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: enabled boolean is required' },
        { status: 400 }
      );
    }

    // Verify domain ownership through merchant access context
    const { data: dData, error: domainError } = await supabase
      .from('domains')
      .select('merchant_id')
      .eq('domain', domain)
      .eq('merchant_id', access.merchantId)
      .single();

    domainData = dData;

    if (domainError || !domainData) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 404 }
      );
    }

    // Get current status for audit log
    let currentStatus = null;
    try {
      currentStatus = await getDomainIDProtection(domain);
    } catch (e) {
      console.warn('Failed to fetch current ID protection status', e);
    }

    // Update ID protection via Go54
    const result = await updateDomainIDProtection(domain, enabled);

    // Log success
    await logAudit(supabase, {
      user_id: userId,
      merchant_id: domainData.merchant_id,
      action: 'id_protection.update',
      resource_type: 'id_protection',
      resource_id: domain,
      changes: {
        before: (currentStatus || undefined) as unknown as Record<
          string,
          unknown
        >,
        after: { enabled },
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success',
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating ID protection:', error);

    // Log failure
    if (userId && supabase) {
      await logAudit(supabase, {
        user_id: userId,
        merchant_id: domainData?.merchant_id,
        action: 'id_protection.update',
        resource_type: 'id_protection',
        resource_id: domain,
        status: 'failure',
        error_message: errorMessage,
      });
    }

    return NextResponse.json(
      { error: 'Failed to update ID protection' },
      { status: 500 }
    );
  }
}
