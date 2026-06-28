import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { logAudit } from '@/lib/audit-logger';
import { checkCsrfProtection } from '@/lib/csrf';
import { validateDNSRecordBatch } from '@/lib/dns-validator';
import { getDomainDNSRecords, updateDomainDNSRecords } from '@/lib/go54';
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';
import { checkRateLimit } from '@/lib/rate-limiter';

/**
 * GET /api/domains/[domain]/dns
 * Get DNS records for a domain
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
      'dns_read',
      100,
      1
    );
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Verify the user can access this domain via merchant context
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

    // Get DNS records from Go54
    const dnsRecords = await getDomainDNSRecords(domain);

    return NextResponse.json(dnsRecords);
  } catch (error) {
    console.error('Error fetching DNS records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DNS records' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains/[domain]/dns
 * Update DNS records for a domain
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

    // Rate Limiting (Stricter for updates)
    const isAllowed = await checkRateLimit(
      supabase,
      userId,
      'dns_update',
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
    const { records } = body;

    if (!records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: 'Invalid request: records array is required' },
        { status: 400 }
      );
    }

    // DNS Validation
    const validation = validateDNSRecordBatch(records);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'DNS record validation failed',
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Verify domain belongs to merchant context
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

    // Get current records for audit log
    let currentRecords: Record<string, unknown> = {};
    try {
      currentRecords = await getDomainDNSRecords(domain);
    } catch (e) {
      console.warn('Failed to fetch current records for audit log', e);
    }

    // Update DNS records via Go54
    const result = await updateDomainDNSRecords(domain, records);

    // Log success
    await logAudit(supabase, {
      user_id: userId,
      merchant_id: domainData.merchant_id,
      action: 'dns.update',
      resource_type: 'dns',
      resource_id: domain,
      changes: {
        before: { records: currentRecords },
        after: { records: records },
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: 'success',
    });

    return NextResponse.json({
      ...result,
      warnings:
        validation.warnings.length > 0 ? validation.warnings : undefined,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating DNS records:', error);

    // Log failure if we have user context
    if (userId && supabase) {
      await logAudit(supabase, {
        user_id: userId,
        merchant_id: domainData?.merchant_id,
        action: 'dns.update',
        resource_type: 'dns',
        resource_id: domain,
        status: 'failure',
        error_message: errorMessage,
      });
    }

    return NextResponse.json(
      { error: 'Failed to update DNS records' },
      { status: 500 }
    );
  }
}
