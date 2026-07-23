import { z } from 'zod';

export const productionOldCancellationProofSchema = z
  .object({
    schemaVersion: z.literal(1),
    identity: z.literal(
      'public.cancel_order_as_customer(p_order_id uuid, p_reason text)'
    ),
    componentSha256: z.literal(
      '6155b28720d0f4a8a20746aa1a2365e631249e940fa7339e0e19b66c28fa1e62'
    ),
    definition: z
      .object({
        byteCount: z.literal(1420),
        sha256: z.literal(
          'fa0ae7bf676a6c14b71aa217e8368ccd71be7a750ff5a1661f26102f72f33fd7'
        ),
      })
      .strict(),
    overlay: z
      .object({
        path: z.literal(
          'supabase/tests/migration_history_overlays/production_old_cancel_order_as_customer.sql'
        ),
        sha256: z.literal(
          '4d40f5cb690ba63c12e900065f0c2ac1cb27db99b0c79960a715f9920c58da9c'
        ),
      })
      .strict(),
    productionEffects: z
      .object({
        fixtureSha256: z.literal(
          '7e396eed09ccfc0d18e5b746e832d7aac9cbba0aabbe0432e1e600c9d8af3381'
        ),
        querySha256: z.literal(
          '2b555af09c8a9cb7e8026b028c014b304de146a9f50a2c2f2a896a6626dfacbc'
        ),
        scopeManifestSha256: z.literal(
          'a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245'
        ),
        ledgerRowCount: z.literal(439),
        ledgerTailVersion: z.literal('20260714225500'),
      })
      .strict(),
  })
  .strict();

export type ProductionOldCancellationProof = z.infer<
  typeof productionOldCancellationProofSchema
>;
