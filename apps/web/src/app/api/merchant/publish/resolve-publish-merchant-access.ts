import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';

type AuthenticatedSupabase = NonNullable<
  Awaited<ReturnType<typeof authenticateApiRequest>>['supabase']
>;

type PublishMerchantAccessResult =
  | {
      merchantId: string;
      ok: true;
      supabase: AuthenticatedSupabase;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function errorResponse(
  error: string,
  status: number
): PublishMerchantAccessResult {
  return {
    ok: false,
    response: NextResponse.json({ error }, { status }),
  };
}

/** Authenticates and authorizes a merchant-selected publish mutation. */
export async function resolvePublishMerchantAccess(
  request: NextRequest
): Promise<PublishMerchantAccessResult> {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return errorResponse('Unauthorized', 401);
  }

  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(request);
  if (!csrfValid) {
    return {
      ok: false,
      response:
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 }),
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid request body', 400);
  }

  const parsedMerchantId = merchantIdParamSchema.safeParse(
    typeof body === 'object' && body !== null && 'merchantId' in body
      ? body.merchantId
      : undefined
  );
  if (!parsedMerchantId.success) {
    return errorResponse('Invalid request body', 400);
  }

  const merchantContext = await getMerchantForApiRequest(
    auth.supabase,
    auth.user.id,
    { requestedMerchantId: parsedMerchantId.data }
  );
  if (!merchantContext) {
    return errorResponse('Merchant not found', 404);
  }

  if (!hasPermission(toUserAccess(merchantContext), 'settings', 'edit')) {
    return errorResponse('Permission denied', 403);
  }

  return {
    merchantId: merchantContext.merchantId,
    ok: true,
    supabase: auth.supabase,
  };
}
