export type EvidenceRunnerModuleKind =
  | 'mutation'
  | 'measurement'
  | 'readRevocation';

const names = Object.freeze({
  mutation: Object.freeze({
    path: 'EVIDENCE_MUTATION_RUNNER_MODULE',
    sha256: 'EVIDENCE_MUTATION_RUNNER_MODULE_SHA256',
  }),
  measurement: Object.freeze({
    path: 'EVIDENCE_MEASUREMENT_RUNNER_MODULE',
    sha256: 'EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256',
  }),
  readRevocation: Object.freeze({
    path: 'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE',
    sha256: 'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256',
  }),
} satisfies Record<
  EvidenceRunnerModuleKind,
  Readonly<{ path: string; sha256: string }>
>);

/** Returns the private environment variable names for one evidence adapter. */
export function evidenceRunnerModuleEnvironmentNames(
  kind: EvidenceRunnerModuleKind
) {
  return names[kind];
}
