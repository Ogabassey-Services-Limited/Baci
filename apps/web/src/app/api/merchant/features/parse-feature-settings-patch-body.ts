import { z } from 'zod';

const merchantFeatureSettingsPatchRequestBodySchema = z.looseObject({});

export type MerchantFeatureSettingsPatchRequestBody = {
  featureUpdates: Record<string, unknown>;
  requestedMerchantId: unknown;
};

/**
 * Confirms a PATCH payload is an object before extracting its tenant selector.
 * Feature-specific validation remains in the route's PATCH schema so partial
 * updates preserve the existing error shape.
 */
export function parseMerchantFeatureSettingsPatchBody(
  body: unknown
): MerchantFeatureSettingsPatchRequestBody | null {
  const parsedBody =
    merchantFeatureSettingsPatchRequestBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return null;
  }

  const { merchantId: requestedMerchantId, ...featureUpdates } =
    parsedBody.data;

  return { featureUpdates, requestedMerchantId };
}
