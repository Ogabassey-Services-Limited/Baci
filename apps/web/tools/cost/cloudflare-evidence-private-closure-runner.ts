import { isAbsolute } from 'node:path';
import type { EvidenceChildCommand } from './cloudflare-evidence-process-isolation';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';
import { evidenceRunnerModuleEnvironmentNames } from './cloudflare-evidence-runner-modules';

const READ_REVOCATION_MODULE_PATH =
  'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE';
const READ_REVOCATION_MODULE_SHA256 =
  'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256';

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
  >,
  inherited: Readonly<Record<string, string | undefined>>
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
            name: READ_REVOCATION_MODULE_PATH,
            sha256Name: READ_REVOCATION_MODULE_SHA256,
            descriptor: {
              path: inherited[READ_REVOCATION_MODULE_PATH],
              sha256: inherited[READ_REVOCATION_MODULE_SHA256],
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
        ? 'read-token revocation readback module descriptor is required'
        : 'journal is missing the reviewed runner module descriptor'
    );
  return {
    name: selected.name,
    sha256Name: selected.sha256Name,
    descriptor: { path, sha256 },
  };
}
