import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { verifyMerchantEmailDomain } from '@/lib/merchant-email-domain';
import {
  emailDomainGate,
  resolveMerchantForEmailDomain,
} from '@/lib/merchant-email-domain-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { isZeptomailDomainsConfigured } from '@/lib/zeptomail-domains';

async function resolveEmailDomainRequest(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!(auth.user && auth.supabase)) {
    return {
      error: NextResponse.json(
        { error: auth.error ?? 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  const resolved = await resolveMerchantForEmailDomain(
    auth.supabase,
    auth.user.id
  );
  if ('error' in resolved) {
    return resolved;
  }
  const denied = emailDomainGate(resolved);
  if (denied) {
    return { error: denied };
  }
  return { ...resolved, supabase: auth.supabase, userId: auth.user.id };
}

function verifyErrorStatus(error: unknown): number {
  if (!(error instanceof Error)) {
    return 502;
  }
  if (error.message === 'No sending domain to verify') {
    return 400;
  }
  const message = error.message.toLowerCase();
  if (message.includes('changed while verification was in progress')) {
    return 409;
  }
  if (
    message.startsWith('failed to load email domain') ||
    message.startsWith('failed to update email domain')
  ) {
    return 500;
  }
  return 502;
}

/** Re-check the merchant's sending domain against ZeptoMail and update status. */
export async function POST(request: NextRequest) {
  const resolved = await resolveEmailDomainRequest(request);
  if ('error' in resolved) {
    return resolved.error;
  }

  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return (
      csrf.response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  if (!isZeptomailDomainsConfigured()) {
    return NextResponse.json(
      {
        error: 'Custom email-domain verification is not configured.',
        code: 'email_domain_provider_unconfigured',
      },
      { status: 503 }
    );
  }

  try {
    const domain = await verifyMerchantEmailDomain(
      resolved.merchantId,
      resolved.supabase,
      {
        actorUserId: resolved.userId,
        supabase: createAdminClient(),
      }
    );
    return NextResponse.json({ domain });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to verify domain',
      },
      { status: verifyErrorStatus(error) }
    );
  }
}
