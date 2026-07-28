import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { createAnonClient } from '@/lib/supabase/anon';
import { createScopedClient } from '@/lib/supabase/scoped';

export type MobileBearerAuthResult =
  | { authenticated: false }
  | {
      authenticated: true;
      user: User;
      supabase: SupabaseClient;
    };

function getStrictBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer ([^\s,]+)$/i);
  return match?.[1] ?? null;
}

export async function getMobileBearerUser(
  request: NextRequest
): Promise<MobileBearerAuthResult> {
  const token = getStrictBearerToken(request);
  if (!token) {
    return { authenticated: false };
  }

  const {
    data: { user },
    error,
  } = await createAnonClient().auth.getUser(token);

  if (error || !user) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    user,
    supabase: createScopedClient(token),
  };
}
