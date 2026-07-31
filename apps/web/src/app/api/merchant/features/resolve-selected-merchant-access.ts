import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserAccess } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';

type ResolveSelectedMerchantAccessInput = {
  requestedMerchantId: unknown;
  supabase: SupabaseClient;
  userId: string;
};

export async function resolveSelectedMerchantAccess({
  requestedMerchantId,
  supabase,
  userId,
}: ResolveSelectedMerchantAccessInput): Promise<{
  access: UserAccess | null;
  invalidMerchantId: boolean;
}> {
  const parsedMerchantId = merchantIdParamSchema.safeParse(
    typeof requestedMerchantId === 'string'
      ? requestedMerchantId.trim()
      : requestedMerchantId
  );
  if (!parsedMerchantId.success) {
    return { access: null, invalidMerchantId: true };
  }

  const merchantContext = await getMerchantForApiRequest(supabase, userId, {
    requestedMerchantId: parsedMerchantId.data,
  });
  return {
    access: merchantContext ? toUserAccess(merchantContext) : null,
    invalidMerchantId: false,
  };
}
