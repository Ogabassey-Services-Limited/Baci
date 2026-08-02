import { z } from 'zod';
import {
  calculateCanonicalSha256,
  canonicalizeJson,
} from '../../../../packages/shared/src/storefront/delivery-evidence';

export type { QualificationArtifactAuthority } from './cloudflare-evidence-qualification-authority';
export {
  matchesQualificationArtifactAuthority,
  matchesQualificationPointerCacheAuthority,
  QualificationArtifactAuthoritySchema,
  QualificationArtifactReceiptSchema,
} from './cloudflare-evidence-qualification-authority';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const ToolingMergeSha = z.string().regex(/^[a-f0-9]{40}$/);
export const QualificationRunBindingSchema = z
  .object({
    runId: z.string().regex(/^[a-f0-9]{32}$/),
    toolingMergeSha: ToolingMergeSha,
    cleanupVerificationReceiptSha256: Hash,
    measurementReceiptSha256: Hash,
    /** Digest of the complete qualification payload returned by measurement. */
    measurementPayloadSha256: Hash,
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
    value.measurementReceiptSha256 === expected.measurementReceiptSha256 &&
    value.measurementPayloadSha256 === expected.measurementPayloadSha256
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

/**
 * The provider measurement receipt commits to this exact payload.  The
 * payload digest is carried in each run binding, so that self-referential
 * field is removed before canonicalization.  Artifact order is normalized by
 * version ID; every other field remains part of the digest.
 */
export function canonicalizeQualificationEvidencePayload(
  readback: unknown,
  artifacts: readonly unknown[]
) {
  const stripPayloadDigest = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripPayloadDigest);
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    const runBinding = record.runBinding;
    if (!runBinding || typeof runBinding !== 'object') return value;
    const {
      measurementPayloadSha256: _measurementPayloadSha256,
      ...withoutPayloadDigest
    } = runBinding as Record<string, unknown>;
    return {
      ...record,
      runBinding: withoutPayloadDigest,
    };
  };
  const normalizedArtifacts = artifacts
    .map(stripPayloadDigest)
    .sort((left, right) => {
      const leftVersion =
        left && typeof left === 'object' && 'versionId' in left
          ? String((left as { versionId?: unknown }).versionId)
          : '';
      const rightVersion =
        right && typeof right === 'object' && 'versionId' in right
          ? String((right as { versionId?: unknown }).versionId)
          : '';
      return leftVersion < rightVersion
        ? -1
        : leftVersion > rightVersion
          ? 1
          : 0;
    });
  return canonicalizeJson({
    readback: stripPayloadDigest(readback),
    artifacts: normalizedArtifacts,
  });
}

export function calculateQualificationEvidencePayloadSha256(
  readback: unknown,
  artifacts: readonly unknown[]
) {
  return calculateCanonicalSha256(
    canonicalizeQualificationEvidencePayload(readback, artifacts)
  );
}
/** Pointer-cache evidence cannot be accepted beyond the reviewed 24-hour window. */
export const MAXIMUM_QUALIFICATION_POINTER_CACHE_AGE_SECONDS = 24 * 60 * 60;
export function qualifyQualificationPointerCache(
  pointerCache: Readonly<{
    qualifiedAt: string;
    expiresAt: string;
    canonicalSha256: string;
  }>,
  now: Date,
  maximumAgeSeconds = MAXIMUM_QUALIFICATION_POINTER_CACHE_AGE_SECONDS
) {
  const nowMs = now.valueOf();
  const qualifiedAt = new Date(pointerCache.qualifiedAt).valueOf();
  const expiresAt = new Date(pointerCache.expiresAt).valueOf();
  const { canonicalSha256: _ignored, ...withoutHash } = pointerCache;
  const effectiveMaximumAgeSeconds =
    Number.isFinite(maximumAgeSeconds) && maximumAgeSeconds >= 0
      ? Math.min(
          maximumAgeSeconds,
          MAXIMUM_QUALIFICATION_POINTER_CACHE_AGE_SECONDS
        )
      : -1;
  return {
    fresh:
      [nowMs, qualifiedAt, expiresAt].every(Number.isFinite) &&
      expiresAt >= qualifiedAt &&
      qualifiedAt <= nowMs &&
      expiresAt > nowMs &&
      nowMs - qualifiedAt <= effectiveMaximumAgeSeconds * 1000,
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

const qualificationArtifactVersionEndpointPattern =
  /^\/accounts\/([^/?#]+)\/workers\/scripts\/([^/?#]+)\/versions\/([^/?#]+)$/;

/** Builds the only endpoint accepted for a Scripts version-detail readback. */
export function buildQualificationArtifactVersionEndpoint(
  accountId: string,
  scriptName: string,
  versionId: string
) {
  return `/accounts/${accountId}/workers/scripts/${scriptName}/versions/${versionId}`;
}

export const QualificationArtifactVersionEndpointSchema = z
  .string()
  .regex(
    qualificationArtifactVersionEndpointPattern,
    'provider version readback must use the exact Scripts version-detail path'
  );

export const QualificationArtifactReadbackVersionSchema = z
  .object({
    versionId: z.string().min(1),
    endpoint: QualificationArtifactVersionEndpointSchema,
    scriptEtag: Hash,
    moduleSha256: Hash,
    modules: QualificationArtifactModuleListSchema,
    moduleListSha256: Hash,
    settingsSha256: Hash,
  })
  .strict()
  .superRefine(({ endpoint, versionId }, context) => {
    const endpointVersionId = endpoint.match(
      qualificationArtifactVersionEndpointPattern
    )?.[3];
    if (endpointVersionId !== versionId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endpoint'],
        message: 'provider version readback endpoint must bind versionId',
      });
  })
  .refine(
    ({ moduleListSha256, modules }) =>
      moduleListSha256 ===
      calculateQualificationArtifactModuleListSha256(modules),
    'provider module-list hash must bind the returned module bytes'
  );
