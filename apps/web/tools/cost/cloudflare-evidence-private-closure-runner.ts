import { isAbsolute } from 'node:path';
import type { EvidenceChildCommand } from './cloudflare-evidence-process-isolation';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';
import { evidenceRunnerModuleEnvironmentNames } from './cloudflare-evidence-runner-modules';

type PrivateEvidenceRunnerDescriptor = Readonly<{
  name: string;
  sha256Name: string;
  descriptor: Readonly<{ path: string; sha256: string }>;
}>;

export function selectPrivateEvidenceRunnerDescriptor(
  command: Exclude<EvidenceChildCommand, 'prepare'>,
  journal: Pick<
    CloudflareEvidenceRunJournal,
    | 'measurementRunnerModulePath'
    | 'measurementRunnerModuleSha256'
    | 'mutationRunnerModulePath'
    | 'mutationRunnerModuleSha256'
    | 'readRevocationRunnerModulePath'
    | 'readRevocationRunnerModuleSha256'
  >
): PrivateEvidenceRunnerDescriptor {
  const selected =
    command === 'measure'
      ? {
          name: evidenceRunnerModuleEnvironmentNames('measurement').path,
          sha256Name:
            evidenceRunnerModuleEnvironmentNames('measurement').sha256,
          descriptor: {
            path: journal.measurementRunnerModulePath,
            sha256: journal.measurementRunnerModuleSha256,
          },
        }
      : command === 'record-read-revocation'
        ? {
            name: evidenceRunnerModuleEnvironmentNames('readRevocation').path,
            sha256Name:
              evidenceRunnerModuleEnvironmentNames('readRevocation').sha256,
            descriptor: {
              path: journal.readRevocationRunnerModulePath,
              sha256: journal.readRevocationRunnerModuleSha256,
            },
          }
        : {
            name: evidenceRunnerModuleEnvironmentNames('mutation').path,
            sha256Name: evidenceRunnerModuleEnvironmentNames('mutation').sha256,
            descriptor: {
              path: journal.mutationRunnerModulePath,
              sha256: journal.mutationRunnerModuleSha256,
            },
          };
  const path = selected.descriptor.path;
  const sha256 = selected.descriptor.sha256;
  if (!path || !sha256 || !isAbsolute(path) || !/^[a-f0-9]{64}$/u.test(sha256))
    throw new Error(
      command === 'record-read-revocation'
        ? 'journal is missing the read-token revocation module descriptor'
        : 'journal is missing the reviewed runner module descriptor'
    );
  return {
    name: selected.name,
    sha256Name: selected.sha256Name,
    descriptor: { path, sha256 },
  };
}
