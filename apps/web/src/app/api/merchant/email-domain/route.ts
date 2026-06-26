import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantEmailDomain,
  registerMerchantEmailDomain,
  setMerchantEmailDomainEnabled,
} from '@/lib/merchant-email-domain';
import {
  emailDomainGate,
  resolveMerchantForEmailDomain,
} from '@/lib/merchant-email-domain-access';
import { isZeptomailDomainsConfigured } from '@/lib/zeptomail-domains';
import {
  registerEmailDomainSchema,
  setEmailDomainEnabledSchema,
} from '@/schemas/merchant-email-domain';

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
  return { ...resolved, supabase: auth.supabase };
}

function isBusinessRuleError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('must be verified') ||
    message.includes('no sending domain to update') ||
    message.includes('active verified storefront domain') ||
    message.includes('already verified in zeptomail') ||
    message.includes('already registered by another merchant')
  );
}

function isStorageError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.startsWith('failed to load email domain') ||
    message.startsWith('failed to save email domain') ||
    message.startsWith('failed to update email domain')
  );
}

export async function GET(request: NextRequest) {
  const resolved = await resolveEmailDomainRequest(request);
  if ('error' in resolved) {
    return resolved.error;
  }

  try {
    const domain = await getMerchantEmailDomain(
      resolved.merchantId,
      resolved.supabase
    );
    return NextResponse.json({ domain });
  } catch {
    return NextResponse.json(
      {
        error: 'Failed to load email domain',
        code: 'email_domain_load_failed',
      },
      { status: 500 }
    );
  }
}

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

  const body = await request.json().catch(() => null);
  const parsed = registerEmailDomainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!isZeptomailDomainsConfigured()) {
    return NextResponse.json(
      {
        error: 'Custom email-domain registration is not configured.',
        code: 'email_domain_provider_unconfigured',
      },
      { status: 503 }
    );
  }

  try {
    const domain = await registerMerchantEmailDomain(
      resolved.merchantId,
      parsed.data.domain
    );
    return NextResponse.json({ domain });
  } catch (error) {
    if (isBusinessRuleError(error)) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to register domain',
        },
        {
          status:
            error instanceof Error &&
            error.message.toLowerCase().includes('already')
              ? 409
              : 400,
        }
      );
    }

    // Don't leak raw exception text in 5xx responses (aligns with GET/PATCH);
    // the internal distinction is preserved in the stable `code` + status.
    return NextResponse.json(
      {
        error: 'Failed to register email domain',
        code: isStorageError(error)
          ? 'email_domain_storage_failed'
          : 'email_domain_upstream_failed',
      },
      { status: isStorageError(error) ? 500 : 502 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const parsed = setEmailDomainEnabledSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const domain = await setMerchantEmailDomainEnabled(
      resolved.merchantId,
      parsed.data.enabled
    );
    return NextResponse.json({ domain });
  } catch (error) {
    if (isBusinessRuleError(error)) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Failed to update domain',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to update email domain',
        code: isStorageError(error)
          ? 'email_domain_storage_failed'
          : 'email_domain_update_failed',
      },
      { status: 500 }
    );
  }
}
