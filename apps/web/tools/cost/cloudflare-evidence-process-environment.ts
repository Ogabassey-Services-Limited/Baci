import { isAbsolute } from 'node:path';
import { readProtectedMergeIdentityAuthorityModuleDescriptor } from './cloudflare-evidence-merge-identity';
import {
  evidenceRunnerModuleEnvironmentNames,
  readEvidenceRunnerModuleDescriptor,
} from './cloudflare-evidence-runner-modules';

export function prepareEvidenceProcessEnvironment(
  inherited: Readonly<Record<string, string | undefined>>
): Record<string, string> {
  if (
    !inherited.EVIDENCE_APPROVAL_ARTIFACT ||
    !inherited.EVIDENCE_POLICY_ARTIFACT ||
    !isAbsolute(inherited.EVIDENCE_APPROVAL_ARTIFACT) ||
    !isAbsolute(inherited.EVIDENCE_POLICY_ARTIFACT)
  )
    throw new Error(
      'prepare authority artifact paths must be absolute and allowlisted'
    );
  readEvidenceRunnerModuleDescriptor(inherited, 'mutation');
  readEvidenceRunnerModuleDescriptor(inherited, 'measurement');
  readEvidenceRunnerModuleDescriptor(inherited, 'readRevocation');
  readProtectedMergeIdentityAuthorityModuleDescriptor(inherited);
  const names = [
    'PATH',
    'TMPDIR',
    'EVIDENCE_APPROVAL_ARTIFACT',
    'EVIDENCE_POLICY_ARTIFACT',
    'EVIDENCE_PROTECTED_MERGE_IDENTITY_ARTIFACT',
    'EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE',
    'EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE_SHA256',
    evidenceRunnerModuleEnvironmentNames('mutation').path,
    evidenceRunnerModuleEnvironmentNames('mutation').sha256,
    evidenceRunnerModuleEnvironmentNames('measurement').path,
    evidenceRunnerModuleEnvironmentNames('measurement').sha256,
    evidenceRunnerModuleEnvironmentNames('readRevocation').path,
    evidenceRunnerModuleEnvironmentNames('readRevocation').sha256,
  ] as const;
  return Object.fromEntries(
    names
      .filter((name) => inherited[name])
      .map((name) => [name, inherited[name] as string])
  );
}
