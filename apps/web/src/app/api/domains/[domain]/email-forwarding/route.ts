import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { logAudit } from '@/lib/audit-logger';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getDomainEmailForwarding,
  updateDomainEmailForwarding,
} from '@/lib/go54';
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';
import { checkRateLimit } from '@/lib/rate-limiter';

/**
 * GET /api/domains/[domain]/email-forwarding
 * Get email forwarding configuration
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
      'email_forwarding_read',
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

    // Get email forwarding from Go54
    const forwarding = await getDomainEmailForwarding(domain);

    return NextResponse.json(forwarding);
  } catch (error) {
    console.error('Error fetching email forwarding:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email forwarding' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains/[domain]/email-forwarding
 * Update email forwarding configuration
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
      'email_forwarding_update',
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
    const { forwards } = body;

    if (!forwards || !Array.isArray(forwards)) {
      return NextResponse.json(
        { error: 'Invalid request: forwards array is required' },
        { status: 400 }
      );
    }

    // Validate email addresses with length limit to prevent ReDoS
    const isValidEmail = (email: string) =>
      email &&
      email.length <= 254 &&
      email.includes('@') &&
      email.indexOf('@') > 0 &&
      email.lastIndexOf('.') > email.indexOf('@') + 1 &&
      !/\s/.test(email);

    for (const forward of forwards) {
      if (!forward.forwardto || !isValidEmail(forward.forwardto)) {
        return NextResponse.json(
          { error: `Invalid destination email: ${forward.forwardto}` },
          { status: 400 }
        );
      }
      if (!forward.prefix) {
        return NextResponse.json(
          { error: 'Email prefix is required' },
          { status: 400 }
        );
      }
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

    // Get current config for audit log
    let currentConfig: Record<string, unknown> = {};
    try {
      currentConfig = await getDomainEmailForwarding(domain);
    } catch (e) {
      console.warn('Failed to fetch current forwarding config', e);
    }

    // Update email forwarding via Go54
    const result = await updateDomainEmailForwarding(domain, forwards);

    // Log success
    await logAudit(supabase, {
      user_id: userId,
      merchant_id: domainData.merchant_id,
      action: 'email_forwarding.update',
      resource_type: 'email_forwarding',
      resource_id: domain,
      changes: {
        before: { forwards: currentConfig },
        after: { forwards: forwards },
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success',
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating email forwarding:', error);

    // Log failure
    if (userId && supabase) {
      await logAudit(supabase, {
        user_id: userId,
        merchant_id: domainData?.merchant_id,
        action: 'email_forwarding.update',
        resource_type: 'email_forwarding',
        resource_id: domain,
        status: 'failure',
        error_message: errorMessage,
      });
    }

    return NextResponse.json(
      { error: 'Failed to update email forwarding' },
      { status: 500 }
    );
  }
}
