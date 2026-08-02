import type { NextResponse } from 'next/server';
import type { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';

export interface CategoryRouteContext {
  /** Server-resolved slug; never sourced from a mutation request body. */
  canonicalMerchantSlug: string | null;
  merchantId: string;
  /** The caller-scoped client, preserving RLS as the final authority. */
  supabase: NonNullable<
    Awaited<ReturnType<typeof getAuthenticatedUser>>
  >['supabase'];
}

export type CategoryRouteResolution =
  | { ok: true; context: CategoryRouteContext }
  | { ok: false; response: NextResponse };

export interface CategoryRequestAuth {
  userId: string;
  supabase: CategoryRouteContext['supabase'];
}

export type CategoryAuthResolution =
  | { ok: true; auth: CategoryRequestAuth }
  | { ok: false; response: NextResponse };
