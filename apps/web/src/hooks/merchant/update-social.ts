// Typed write helper for merchant social-media handles (PR-D / V1).
//
// `social_media` is an IDENTITY field, so it is rejected by the generic
// `updateMerchant` hook (see merchant-writable-fields.ts). Social-media editors
// must persist through the dedicated, server-allowlisted PATCH route
// `/api/merchant/settings`, which validates with `updateMerchantSettingsSchema`
// and normalizes the handles server-side.

import type { SocialMediaValues } from '@baci/shared';
import { apiPatch } from '@/lib/api-client';

export interface UpdateSocialResponse {
  merchant: {
    id: string;
    social_media: SocialMediaValues | null;
    [key: string]: unknown;
  };
}

/**
 * Persists merchant social-media handles via the dedicated, CSRF-protected
 * `/api/merchant/settings` PATCH route. Throws on a non-2xx response (the error
 * message is surfaced from the route's JSON body by `apiPatch`).
 */
export function updateSocial(
  merchantId: string,
  socialMedia: SocialMediaValues
): Promise<UpdateSocialResponse> {
  return apiPatch<UpdateSocialResponse>('/api/merchant/settings', {
    merchantId,
    social_media: socialMedia,
  });
}
