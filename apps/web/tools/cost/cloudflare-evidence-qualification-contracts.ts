import { z } from 'zod';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const QUALIFICATION_EVIDENCE_HOST = 'edge-evidence.ogabassey.com';

export const PurgeContractSchema = z
  .object({
    endpoint: z.string().regex(/^\/zones\/[^/]+\/purge_cache$/),
    requestSchemaSha256: Hash,
    rateLimitFingerprint: Hash,
    policySha256: Hash,
    productionResourceState: z.enum([
      'present_verified',
      'absent_requires_bootstrap',
    ]),
  })
  .strict();

export const TopologyEndpointSchema = z
  .object({
    family: z.enum(['worker-custom-domain', 'r2-cors', 'r2-custom-domain']),
    endpoint: z.string().startsWith('/accounts/'),
    requestSchemaSha256: Hash,
    responseSchemaSha256: Hash,
    maximumVisibilitySeconds: z.number().int().positive(),
  })
  .strict();

export const QualificationPurgeReceiptSchema = z
  .object({
    endpoint: z.string().regex(/^\/zones\/[^/]+\/purge_cache$/),
    zoneId: z.string().min(1),
    host: z.literal(QUALIFICATION_EVIDENCE_HOST),
    requestSchemaSha256: Hash,
    rateLimitFingerprint: Hash,
    policySha256: Hash,
    operationId: z.string().min(1),
    status: z.enum(['complete', 'lost_response']),
    readbackVerified: z.literal(true),
  })
  .strict();

export const QualificationTopologyReceiptSchema = z
  .object({
    family: z.enum(['worker-custom-domain', 'r2-cors', 'r2-custom-domain']),
    action: z.enum(['detach', 'reattach', 'write']),
    restoreAction: z.enum(['detach', 'reattach', 'write']),
    endpoint: z.string().startsWith('/accounts/'),
    requestSchemaSha256: Hash,
    responseSchemaSha256: Hash,
    restoreRequestSchemaSha256: Hash,
    restoreResponseSchemaSha256: Hash,
    operationId: z.string().min(1).nullable(),
    lostResponse: z.boolean(),
    restored: z.literal(true),
  })
  .strict();

export const QualificationControlEvidenceSchema = z
  .object({
    purge: QualificationPurgeReceiptSchema,
    topology: z
      .array(QualificationTopologyReceiptSchema)
      .length(3)
      .superRefine((receipts, context) => {
        const families = new Set(receipts.map(({ family }) => family));
        if (families.size !== 3)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['family'],
            message: 'topology receipts must cover each provider family once',
          });
        for (const [index, receipt] of receipts.entries()) {
          const expectedRestoreAction =
            receipt.action === 'detach' ? 'reattach' : 'write';
          if (receipt.restoreAction !== expectedRestoreAction)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'restoreAction'],
              message: 'topology restore action must invert the forward action',
            });
          if (
            receipt.restoreRequestSchemaSha256 === receipt.requestSchemaSha256
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'restoreRequestSchemaSha256'],
              message: 'topology restore request must be independently bound',
            });
        }
      }),
  })
  .strict();
