import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeAuthNextTarget } from '@/lib/auth-redirect';
import { createClient } from '@/lib/supabase/server';

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
  const parsed = confirmEmailSchema.safeParse({
    token_hash: url.searchParams.get('token_hash'),
    type: url.searchParams.get('type'),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      `${url.origin}/login?error=${encodeURIComponent('Invalid confirmation link')}`
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { error } = await supabase.auth.verifyOtp(parsed.data);

  if (error) {
    return NextResponse.redirect(
      `${url.origin}/login?error=${encodeURIComponent(error.message || 'Could not authenticate user')}`
    );
  }

  return NextResponse.redirect(
    next.startsWith('baciadmin://') ? next : `${url.origin}${next}`
  );
}
