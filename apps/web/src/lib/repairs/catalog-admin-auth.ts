import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
  type UserAccess,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';

/**
 * Shared authorization gate for the repairs catalogue dashboard routes.
 *
 * Runs the standard sequence — authenticate (cookie or bearer), CSRF (only
 * enforced on mutations), resolve merchant access, then check the `repairs`
 * permission for the requested action. On success returns the RLS-scoped
 * client and the caller's access; otherwise a ready-to-return error response.
 */

export type RepairsAction = 'view' | 'edit' | 'delete';

export type RepairsAuthzResult =
  | { ok: true; access: UserAccess; supabase: SupabaseClient }
  | { ok: false; response: NextResponse };

export async function authorizeRepairsRequest(
  request: NextRequest | Request,
  action: RepairsAction
): Promise<RepairsAuthzResult> {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const csrf = await checkCsrfProtection(request as NextRequest);
  if (!csrf.valid) {
    return {
      ok: false,
      response:
        csrf.response ??
        NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
    };
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }

  if (!hasPermission(access, 'repairs', action)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, access, supabase: auth.supabase };
}
