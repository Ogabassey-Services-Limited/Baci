import { getReadTokenRevocationReadbackFactory } from './cloudflare-evidence-read-revocation-factory';
import { importReviewedEvidenceModule } from './cloudflare-evidence-reviewed-module-loader';
import type {
  EvidenceRunnerModuleDescriptor,
  ReviewedEvidenceModuleSource,
} from './cloudflare-evidence-runner-modules';

type PreparedEvidenceRunner = EvidenceRunnerModuleDescriptor & {
  files: readonly ReviewedEvidenceModuleSource[];
};
type PreparedEvidenceRunnerKind = 'mutation' | 'measurement' | 'readRevocation';

const factoryExports = {
  mutation: 'createMutationDependencies',
  measurement: 'createMeasurementDependencies',
} as const;

/** Verifies the one supported factory in an owner-approved evidence adapter. */
export async function validatePreparedEvidenceRunnerFactory(
  workspaceRoot: string,
  descriptor: PreparedEvidenceRunner,
  kind: PreparedEvidenceRunnerKind
) {
  await importReviewedEvidenceModule(
    workspaceRoot,
    descriptor.path,
    descriptor.files,
    (loaded) => {
      if (kind === 'readRevocation') {
        getReadTokenRevocationReadbackFactory(loaded);
        return;
      }
      const factory =
        loaded && typeof loaded === 'object'
          ? (loaded as Record<string, unknown>)[factoryExports[kind]]
          : undefined;
      if (typeof factory !== 'function')
        throw new Error(`${kind} runner module is invalid`);
    }
  );
}
