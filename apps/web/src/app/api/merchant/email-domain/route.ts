import { type NextRequest, NextResponse } from 'next/server';
import {
  getMerchantEmailDomain,
  registerMerchantEmailDomain,
  setMerchantEmailDomainEnabled,
} from '@/lib/merchant-email-domain';
import {
  emailDomainGate,
  resolveMerchantForEmailDomain,
} from '@/lib/merchant-email-domain-access';
import { createClient } from '@/lib/supabase/server';
import {
  registerEmailDomainSchema,
  setEmailDomainEnabledSchema,
} from '@/schemas/merchant-email-domain';

export async function GET() {
  const supabase = await createClient();
  const resolved = await resolveMerchantForEmailDomain(supabase);
  if ('error' in resolved) {
    return resolved.error;
  }
  const domain = await getMerchantEmailDomain(resolved.merchantId);
  return NextResponse.json({ domain });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const resolved = await resolveMerchantForEmailDomain(supabase);
  if ('error' in resolved) {
    return resolved.error;
  }
  const denied = emailDomainGate(resolved);
  if (denied) {
    return denied;
  }

  const body = await request.json().catch(() => null);
  const parsed = registerEmailDomainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const domain = await registerMerchantEmailDomain(
      resolved.merchantId,
      parsed.data.domain
    );
    return NextResponse.json({ domain });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to register domain',
      },
      { status: 502 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const resolved = await resolveMerchantForEmailDomain(supabase);
  if ('error' in resolved) {
    return resolved.error;
  }
  const denied = emailDomainGate(resolved);
  if (denied) {
    return denied;
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
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update domain',
      },
      { status: 400 }
    );
  }
}
