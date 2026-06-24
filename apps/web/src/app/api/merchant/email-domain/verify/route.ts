import { NextResponse } from 'next/server';
import { verifyMerchantEmailDomain } from '@/lib/merchant-email-domain';
import {
  emailDomainGate,
  resolveMerchantForEmailDomain,
} from '@/lib/merchant-email-domain-access';
import { createClient } from '@/lib/supabase/server';

/** Re-check the merchant's sending domain against ZeptoMail and update status. */
export async function POST() {
  const supabase = await createClient();
  const resolved = await resolveMerchantForEmailDomain(supabase);
  if ('error' in resolved) {
    return resolved.error;
  }
  const denied = emailDomainGate(resolved);
  if (denied) {
    return denied;
  }

  try {
    const domain = await verifyMerchantEmailDomain(resolved.merchantId);
    return NextResponse.json({ domain });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to verify domain',
      },
      { status: 502 }
    );
  }
}
