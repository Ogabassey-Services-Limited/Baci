import type { z } from 'zod';
import type { QualificationControlEvidenceSchema } from './cloudflare-evidence-qualification-contracts';

type QualificationControlEvidence = z.infer<
  typeof QualificationControlEvidenceSchema
>;

export function isQualificationControlEvidenceInScope(
  evidence: QualificationControlEvidence,
  accountId: string,
  scriptName: string
) {
  const expectedPrefix = `/accounts/${accountId}/`;
  return (
    evidence.topology.every(({ endpoint }) =>
      endpoint.startsWith(expectedPrefix)
    ) &&
    evidence.topology.every(
      ({ family, endpoint }) =>
        family !== 'worker-custom-domain' ||
        endpoint.includes(`/workers/scripts/${scriptName}/domains/custom/`)
    )
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
