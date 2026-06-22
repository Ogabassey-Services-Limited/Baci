import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { revalidateMerchantFeed } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { triggerDomainEdgeConfigSync } from '@/lib/edge-config-sync';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { vercel } from '@/lib/vercel';

/**
 * Parse Vercel verification challenges into user-friendly error messages
 */
function getVerificationErrorMessage(
  verification:
    | Array<{ type: string; domain: string; value: string; reason: string }>
    | undefined,
  domain: string
): string {
  if (!verification || verification.length === 0) {
    return 'DNS verification failed. Please ensure your A record points to 76.76.21.21';
  }

  const txtChallenge = verification.find((v) => v.type === 'TXT');
  const aRecordIssue = verification.find(
    (v) =>
      v.reason?.includes('A record') ||
      v.reason?.includes('Invalid Configuration')
  );

  if (txtChallenge) {
    // Check for underscore restriction hint
    const underscoreRestrictionHint =
      txtChallenge.reason?.toLowerCase().includes('underscore') ||
      txtChallenge.reason?.toLowerCase().includes('invalid hostname');

    if (underscoreRestrictionHint) {
      return `Your DNS provider may not support underscore (_) in hostnames. Try adding a TXT record for "_vercel.${domain}" with value "${txtChallenge.value}". If your provider blocks this, consider using Vercel Nameservers instead.`;
    }

    return `Domain _vercel.${domain} is missing required TXT Record "${txtChallenge.value}"`;
  }

  if (aRecordIssue) {
    return 'A record not found. Please add an A record for @ pointing to 76.76.21.21';
  }

  // Default: join all reasons
  const reasons = verification
    .map((v) => v.reason)
    .filter(Boolean)
    .join('. ');
  return (
    reasons ||
    'DNS verification failed. Please check your DNS records and try again.'
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(_request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const { domain } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify domain belongs to user's merchant account
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
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

    const merchantId = merchantContext.merchantId;

    const { data: domainRecord, error: domainError } = await supabase
      .from('domains')
      .select('id, verification_token')
      .eq('domain', domain)
      .eq('merchant_id', merchantId)
      .single();

    if (domainError || !domainRecord) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 403 }
      );
    }

    // Call Vercel Verify API
    let verifyResult: Awaited<ReturnType<typeof vercel.verifyDomain>>;
    try {
      verifyResult = await vercel.verifyDomain(domain);
    } catch (vercelError: unknown) {
      console.error('Vercel verification error:', vercelError);
      const errorMessage =
        vercelError instanceof Error ? vercelError.message : 'Unknown error';
      return NextResponse.json(
        {
          success: false,
          error:
            errorMessage ||
            'Failed to connect to verification service. Please try again.',
        },
        { status: 500 }
      );
    }

    const isVerified = verifyResult.verified;

    if (isVerified) {
      // Update DB
      const { error: updateError } = await supabase
        .from('domains')
        .update({
          status: 'active',
          ssl_status: 'active',
          verified_at: new Date().toISOString(),
        })
        .eq('id', domainRecord.id)
        .eq('merchant_id', merchantId);

      if (updateError) {
        throw new Error('Failed to update domain status');
      }

      revalidateMerchantFeed(merchantId);
      after(() => triggerDomainEdgeConfigSync());

      return NextResponse.json({
        success: true,
        verified: true,
        message: 'Domain successfully verified and active! 🎉',
      });
    } else {
      // Not verified - provide specific error message
      const errorMessage = getVerificationErrorMessage(
        verifyResult.verification,
        domain
      );

      // If Vercel returned new verification challenges, update stored token
      if (verifyResult.verification) {
        const txtChallenge = verifyResult.verification.find(
          (v) => v.type === 'TXT'
        );
        if (
          txtChallenge &&
          txtChallenge.value !== domainRecord.verification_token
        ) {
          // Update the token in DB so UI shows the correct value
          await supabase
            .from('domains')
            .update({ verification_token: txtChallenge.value })
            .eq('id', domainRecord.id)
            .eq('merchant_id', merchantId);
        }
      }

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: errorMessage,
          details: verifyResult.verification,
        },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to verify domain';
    console.error('Error verifying domain:', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
