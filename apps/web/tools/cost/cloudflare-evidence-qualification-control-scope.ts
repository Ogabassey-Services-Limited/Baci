import { z } from 'zod';
import type { QualificationControlEvidenceSchema } from './cloudflare-evidence-qualification-contracts';

type QualificationControlEvidence = z.infer<
  typeof QualificationControlEvidenceSchema
>;
export const QualificationControlScopeSchema = z
  .object({
    accountId: z.string().min(1),
    zoneId: z.string().min(1),
    scriptName: z.string().min(1),
    bucketName: z.string().min(1),
  })
  .strict();
export type QualificationControlScope = z.infer<
  typeof QualificationControlScopeSchema
>;
export const hasValidQualificationControlScope = (value: unknown) =>
  QualificationControlScopeSchema.safeParse(value).success;
const QUALIFICATION_EVIDENCE_HOST = 'edge-evidence.ogabassey.com';

export function isQualificationControlEvidenceInScope(
  evidence: QualificationControlEvidence,
  scope: QualificationControlScope | undefined
) {
  if (!scope) return false;
  if (
    evidence.purge.zoneId !== scope.zoneId ||
    evidence.purge.endpoint !== `/zones/${scope.zoneId}/purge_cache`
  )
    return false;
  const endpoints = {
    'worker-custom-domain': `/accounts/${scope.accountId}/workers/scripts/${scope.scriptName}/domains/custom/${QUALIFICATION_EVIDENCE_HOST}`,
    'r2-cors': `/accounts/${scope.accountId}/r2/buckets/${scope.bucketName}/cors`,
    'r2-custom-domain': `/accounts/${scope.accountId}/r2/buckets/${scope.bucketName}/domains/custom/${QUALIFICATION_EVIDENCE_HOST}`,
  } as const;
  return evidence.topology.every(
    ({ family, endpoint }) => endpoint === endpoints[family]
  );
}

export function hasReviewedQualificationArtifactIdentity(
  artifacts: readonly {
    accountId: string;
    versionId: string;
    scriptName: string;
    artifactReceipt: {
      bundleSha256: string;
      canonicalSourceSha256: string;
    };
  }[],
  expectedScriptName: string,
  expectedAccountId: string | undefined
) {
  const accounts = new Set(artifacts.map(({ accountId }) => accountId));
  return (
    artifacts.length === 2 &&
    accounts.size === 1 &&
    (expectedAccountId === undefined || accounts.has(expectedAccountId)) &&
    new Set(artifacts.map(({ versionId }) => versionId)).size === 2 &&
    new Set(artifacts.map(({ scriptName }) => scriptName)).size === 1 &&
    new Set(
      artifacts.map(({ artifactReceipt }) => artifactReceipt.bundleSha256)
    ).size === 2 &&
    new Set(
      artifacts.map(
        ({ artifactReceipt }) => artifactReceipt.canonicalSourceSha256
      )
    ).size === 2 &&
    artifacts.every(({ scriptName }) => scriptName === expectedScriptName)
  );
}
