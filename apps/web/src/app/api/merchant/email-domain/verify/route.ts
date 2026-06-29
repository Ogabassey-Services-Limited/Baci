import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { verifyMerchantEmailDomain } from '@/lib/merchant-email-domain';
import { resolveEmailDomainRequest } from '@/lib/merchant-email-domain-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { isZeptomailDomainsConfigured } from '@/lib/zeptomail-domains';

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

function verifyErrorResponse(error: unknown) {
  const status = verifyErrorStatus(error);
  if (status >= 500) {
    return {
      body: {
        error: 'Failed to verify email domain',
        code:
          status === 500
            ? 'email_domain_storage_failed'
            : 'email_domain_upstream_failed',
      },
      status,
    };
  }

  if (
    error instanceof Error &&
    error.message === 'No sending domain to verify'
  ) {
    return {
      body: {
        error: error.message,
        code: 'email_domain_not_found',
      },
      status,
    };
  }

  return {
    body: {
      error: error instanceof Error ? error.message : 'Failed to verify domain',
      code: 'email_domain_verification_stale',
    },
    status,
  };
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
    const response = verifyErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
