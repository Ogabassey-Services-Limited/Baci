import { z } from 'zod';
import {
  calculateCanonicalSha256,
  canonicalizeJson,
} from '../../../../packages/shared/src/storefront/delivery-evidence';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const QualificationRunBindingSchema = z
  .object({
    runId: z.string().regex(/^[a-f0-9]{32}$/),
    toolingMergeSha: z.string().regex(/^[a-f0-9]{40}$/),
    cleanupVerificationReceiptSha256: Hash,
    measurementReceiptSha256: Hash,
  })
  .strict();
export type QualificationRunBinding = z.infer<
  typeof QualificationRunBindingSchema
>;
export function matchesQualificationRunBinding(
  value: QualificationRunBinding,
  expected: QualificationRunBinding
) {
  return (
    value.runId === expected.runId &&
    value.toolingMergeSha === expected.toolingMergeSha &&
    value.cleanupVerificationReceiptSha256 ===
      expected.cleanupVerificationReceiptSha256 &&
    value.measurementReceiptSha256 === expected.measurementReceiptSha256
  );
}
export function matchesQualificationRunBindings(
  readback: QualificationRunBinding,
  artifacts: readonly QualificationRunBinding[],
  expected: QualificationRunBinding
) {
  return (
    matchesQualificationRunBinding(readback, expected) &&
    artifacts.every((artifact) =>
      matchesQualificationRunBinding(artifact, expected)
    )
  );
}
export function calculatePointerCacheCanonicalSha256(value: unknown) {
  return calculateCanonicalSha256(canonicalizeJson(value));
}
export function qualifyQualificationPointerCache(
  pointerCache: Readonly<{
    qualifiedAt: string;
    expiresAt: string;
    canonicalSha256: string;
  }>,
  now: Date,
  maximumAgeSeconds: number
) {
  const nowMs = now.valueOf();
  const qualifiedAt = new Date(pointerCache.qualifiedAt).valueOf();
  const expiresAt = new Date(pointerCache.expiresAt).valueOf();
  const { canonicalSha256: _ignored, ...withoutHash } = pointerCache;
  return {
    fresh:
      [nowMs, qualifiedAt, expiresAt].every(Number.isFinite) &&
      expiresAt >= qualifiedAt &&
      qualifiedAt <= nowMs &&
      expiresAt > nowMs &&
      nowMs - qualifiedAt <= maximumAgeSeconds * 1000,
    fingerprintValid:
      pointerCache.canonicalSha256 ===
      calculatePointerCacheCanonicalSha256(withoutHash),
  } as const;
}

/**
 * Provider module bytes are normalized to base64 before they cross the
 * readback boundary. This is the same wire representation used by the
 * qualification worker receipt, so hashes can be compared independently.
 */
export const QualificationArtifactModuleSchema = z
  .object({
    name: z.string().min(1),
    bytesBase64: z
      .string()
      .regex(
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
      ),
  })
  .strict();

export const QualificationArtifactModuleListSchema = z
  .array(QualificationArtifactModuleSchema)
  .min(1)
  .superRefine((modules, context) => {
    const names = new Set<string>();
    for (const [index, module] of modules.entries()) {
      if (names.has(module.name))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'name'],
          message: 'module names must be unique',
        });
      names.add(module.name);
    }
  });

export type QualificationArtifactModule = z.infer<
  typeof QualificationArtifactModuleSchema
>;

/** Canonicalizes names and exact provider-returned module bytes. */
export function canonicalizeQualificationArtifactModules(
  modules: readonly QualificationArtifactModule[]
) {
  const parsed = QualificationArtifactModuleListSchema.parse(modules);
  return JSON.stringify(
    [...parsed]
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0
      )
      .map(({ name, bytesBase64 }) => ({ name, bytesBase64 }))
  );
}

export function calculateQualificationArtifactModuleListSha256(
  modules: readonly QualificationArtifactModule[]
) {
  return calculateCanonicalSha256(
    canonicalizeQualificationArtifactModules(modules)
  );
}

export const QualificationArtifactReadbackVersionSchema = z
  .object({
    versionId: z.string().min(1),
    endpoint: z.string().min(1),
    scriptEtag: Hash,
    moduleSha256: Hash,
    modules: QualificationArtifactModuleListSchema,
    moduleListSha256: Hash,
    settingsSha256: Hash,
  })
  .strict()
  .refine(
    ({ moduleListSha256, modules }) =>
      moduleListSha256 ===
      calculateQualificationArtifactModuleListSha256(modules),
    'provider module-list hash must bind the returned module bytes'
  );
