import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalReplayEffectJson } from '../canonical-replay-effect-json';

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const category = z.enum([
  'constraint',
  'event-relation',
  'extension',
  'function',
  'grant-vector',
  'index',
  'pgmq-access',
  'pgmq-queue',
  'policy',
  'producer-config',
  'relation-security',
  'schema-presence',
  'selected-column',
  'trigger',
]);
const digest = z
  .object({ category, identity: z.string().min(1), sha256 })
  .strict();
const effects = z
  .object({
    componentCount: z.literal(76),
    customerCancellationSurfacePresent: z.literal(true),
    domainEventRpcCount: z.literal(19),
    eventPolicyRolesExact: z.literal(true),
    everyDomainEventProducerDisabled: z.literal(true),
    fulfillmentTimestampsReady: z.literal(true),
    merchantAnonProjectionExact: z.literal(true),
    merchantFeatureSettingsReadWithheld: z.literal(true),
    pgmqDomainEventsQueuePresent: z.literal(true),
    pgmqProtectedRolesWithheld: z.literal(true),
    pgmqPublicSchemaAbsent: z.literal(true),
    requiredExtensionsPresent: z.literal(true),
  })
  .strict();
const identity = (value: { category: string; identity: string }) =>
  `${value.category}\0${value.identity}`;
const frozenV3IdentitySetSha256 =
  '942ab48ec28dc16299ed2697c537f6e536e65af52f49eea39d6f4e4d4ad367fa';

function validateFrozenV3EffectIdentities(
  values: readonly { category: string; identity: string }[]
): void {
  const identities = values.map(identity);
  const identitySetSha256 = createHash('sha256')
    .update(JSON.stringify([...identities].sort()))
    .digest('hex');
  if (
    new Set(identities).size !== 76 ||
    identitySetSha256 !== frozenV3IdentitySetSha256
  ) {
    throw new Error('frozen v3 effect identity scope mismatch');
  }
}

export const productionOldCancellationSourceEffectsSchema = z
  .object({
    baseSha: z.literal('9e3d1b14b1931a5e441fc23f0e5417c188056e47'),
    diagnostics: z
      .object({
        extensionVersions: z.tuple([
          z
            .object({
              name: z.literal('pgcrypto'),
              schema: z.literal('extensions'),
              version: z.string().min(1),
            })
            .strict(),
          z
            .object({
              name: z.literal('pgmq'),
              schema: z.literal('pgmq'),
              version: z.string().min(1),
            })
            .strict(),
        ]),
      })
      .strict(),
    digestVector: z.array(digest).length(76),
    effectSha256: sha256,
    effects,
    ledger: z
      .object({
        rowCount: z.literal(439),
        tailVersion: z.literal('20260714225500'),
      })
      .strict(),
    schemaVersion: z.literal(2),
    scope: z
      .object({
        componentCount: z.literal(76),
        manifestSha256: z.literal(
          'a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245'
        ),
        version: z.literal('baci-p0-effects-v3'),
      })
      .strict(),
    source: z
      .object({
        kind: z.literal('supabase-management-api-read-only'),
        querySha256: z.literal(
          '2b555af09c8a9cb7e8026b028c014b304de146a9f50a2c2f2a896a6626dfacbc'
        ),
        serverVersionNum: z.literal(170006),
      })
      .strict(),
  })
  .strict()
  .superRefine((fixture, context) => {
    const ordered = [...fixture.digestVector].sort((left, right) =>
      identity(left) < identity(right)
        ? -1
        : identity(left) > identity(right)
          ? 1
          : 0
    );
    if (
      canonicalReplayEffectJson(ordered) !==
      canonicalReplayEffectJson(fixture.digestVector)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'legacy effect digest vector order mismatch',
        path: ['digestVector'],
      });
    }
    try {
      validateFrozenV3EffectIdentities(fixture.digestVector);
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'legacy effect digest vector scope mismatch',
        path: ['digestVector'],
      });
    }
    const digestSha256 = createHash('sha256')
      .update(canonicalReplayEffectJson(fixture.digestVector))
      .digest('hex');
    if (fixture.effectSha256 !== digestSha256) {
      context.addIssue({
        code: 'custom',
        message: 'legacy effect digest vector hash mismatch',
        path: ['effectSha256'],
      });
    }
  });
