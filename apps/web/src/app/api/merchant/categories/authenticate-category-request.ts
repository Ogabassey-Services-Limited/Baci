import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';
import type { CategoryAuthResolution } from './category-route-types';

/** Authenticate before CSRF handling or body parsing, for Bearer and cookies. */
export async function authenticateCategoryRequest(
  request: Request
): Promise<CategoryAuthResolution> {
  const auth = await getAuthenticatedUser(request);
  if (!auth?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return {
    ok: true,
    auth: { userId: auth.user.id, supabase: auth.supabase },
  };
}
