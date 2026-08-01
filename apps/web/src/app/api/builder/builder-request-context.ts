import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';

interface BuilderRequestContext {
  merchantId: string;
  supabase: SupabaseClient;
  canEdit: boolean;
}

type BuilderAuthentication = NonNullable<
  Awaited<ReturnType<typeof getAuthenticatedUser>>
>;

type BuilderContextResult =
  | { context: BuilderRequestContext; response?: never }
  | { response: NextResponse; context?: never };

type BuilderAuthenticationResult =
  | { auth: BuilderAuthentication; response?: never }
  | { response: NextResponse; auth?: never };

export async function getBuilderRequestContext(
  request: NextRequest,
  action: 'view' | 'edit',
  requestedMerchantId?: string,
  authentication?: BuilderAuthentication
): Promise<BuilderContextResult> {
  const auth = authentication ?? (await getAuthenticatedUser(request));
  if (!auth) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { user, supabase } = auth;
  const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
    requestedMerchantId,
  });
  if (!merchantContext) {
    return {
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }

  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'builder', action)) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    context: {
      merchantId: merchantContext.merchantId,
      supabase,
      canEdit: hasPermission(access, 'builder', 'edit'),
    },
  };
}

export async function getBuilderAuthentication(
  request: NextRequest
): Promise<BuilderAuthenticationResult> {
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { auth };
}
