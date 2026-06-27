import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeAuthNextTarget } from '@/lib/auth-redirect';
import { createClient } from '@/lib/supabase/server';

function buildConfirmationErrorRedirect(
  origin: string,
  message: string,
  requestHeaders: Headers
): string {
  const isStorefrontDomainConfirm = Boolean(
    requestHeaders.get('x-custom-domain') ||
      requestHeaders.get('x-merchant-domain')
  );
  const loginPath = isStorefrontDomainConfirm ? '/account/login' : '/login';
  return `${origin}${loginPath}?error=${encodeURIComponent(message)}`;
}

const confirmEmailSchema = z.object({
  token_hash: z.string().trim().min(1),
  type: z.enum([
    'signup',
    'invite',
    'magiclink',
    'recovery',
    'email_change',
    'email',
  ]),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = normalizeAuthNextTarget(
    url.searchParams.get('next'),
    url.origin
  );
  const requestHeaders = await headers();
  const parsed = confirmEmailSchema.safeParse({
    token_hash: url.searchParams.get('token_hash'),
    type: url.searchParams.get('type'),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      buildConfirmationErrorRedirect(
        url.origin,
        'Invalid confirmation link',
        requestHeaders
      )
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { error } = await supabase.auth.verifyOtp(parsed.data);

  if (error) {
    return NextResponse.redirect(
      buildConfirmationErrorRedirect(
        url.origin,
        error.message || 'Could not authenticate user',
        requestHeaders
      )
    );
  }

  return NextResponse.redirect(
    next.startsWith('baciadmin://') ? next : `${url.origin}${next}`
  );
}
