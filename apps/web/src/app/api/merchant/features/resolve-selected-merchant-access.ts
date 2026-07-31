import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserAccess, type UserAccess } from '@/lib/api-auth';
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
  const parsedMerchantId = merchantIdParamSchema
    .optional()
    .safeParse(requestedMerchantId);
  if (!parsedMerchantId.success) {
    return { access: null, invalidMerchantId: true };
  }

  if (!parsedMerchantId.data) {
    return {
      access: await getUserAccess(supabase),
      invalidMerchantId: false,
    };
  }

  const merchantContext = await getMerchantForApiRequest(supabase, userId, {
    requestedMerchantId: parsedMerchantId.data,
  });
  return {
    access: merchantContext ? toUserAccess(merchantContext) : null,
    invalidMerchantId: false,
  };
}
