import { z } from 'zod';

const MAX_NON_STREAMED_RPC_DTO_BYTES = 4_194_304;

/** Bounded transport envelope for one coherent storefront publication snapshot. */
export const StorefrontPublicProjectionSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    merchantId: z.uuid(),
    publicationGeneration: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    componentContractVersion: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    payload: z.json(),
  })
  .superRefine((projection, context) => {
    const serializedBytes = new TextEncoder().encode(
      JSON.stringify(projection)
    ).byteLength;
    if (serializedBytes > MAX_NON_STREAMED_RPC_DTO_BYTES)
      context.addIssue({
        code: 'custom',
        message: 'projection exceeds the 4 MiB RPC DTO limit',
      });
  });

export type StorefrontPublicProjection = z.infer<
  typeof StorefrontPublicProjectionSchema
>;
