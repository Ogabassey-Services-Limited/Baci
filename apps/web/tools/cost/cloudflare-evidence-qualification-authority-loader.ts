import {
  type QualificationArtifactAuthority,
  QualificationArtifactAuthoritySchema,
} from './cloudflare-evidence-qualification-authority';
import {
  type CloudflareOwnerAcceptanceAuthorityResolver,
  OwnerAcceptanceSchema,
} from './cloudflare-evidence-qualification-traffic';
import { importReviewedEvidenceModule } from './cloudflare-evidence-reviewed-module-loader';
import {
  type EvidenceRunnerModuleDescriptor,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';

type OwnerAcceptanceAuthorityModule = Readonly<{
  resolveOwnerAcceptanceAuthority: () => unknown | Promise<unknown>;
}>;

type QualificationArtifactAuthorityModule = Readonly<{
  resolveQualificationArtifactAuthority: () => unknown | Promise<unknown>;
}>;

export async function loadOwnerAcceptanceAuthority(
  environment: Readonly<Record<string, string | undefined>>,
  expectedToolingMergeSha: string
): Promise<CloudflareOwnerAcceptanceAuthorityResolver> {
  const workspaceRoot = environment.EVIDENCE_WORKSPACE_ROOT;
  const configuredToolingMergeSha = environment.EVIDENCE_TOOLING_MERGE_SHA;
  const path = environment.EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE;
  const sha256 = environment.EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE_SHA256;
  if (
    !workspaceRoot ||
    !expectedToolingMergeSha ||
    (configuredToolingMergeSha !== undefined &&
      configuredToolingMergeSha !== expectedToolingMergeSha) ||
    !path ||
    !sha256
  )
    throw new Error(
      'independently authenticated owner acceptance readback is required'
    );
  const descriptor: EvidenceRunnerModuleDescriptor = { path, sha256 };
  const verified = await verifyReviewedEvidenceRunnerModule(
    workspaceRoot,
    expectedToolingMergeSha,
    descriptor
  );
  const authoritative = await importReviewedEvidenceModule(
    workspaceRoot,
    verified.path,
    verified.files,
    async (loaded) => {
      if (
        !loaded ||
        typeof loaded !== 'object' ||
        !('resolveOwnerAcceptanceAuthority' in loaded) ||
        typeof (loaded as Partial<OwnerAcceptanceAuthorityModule>)
          .resolveOwnerAcceptanceAuthority !== 'function'
      )
        throw new Error('owner acceptance authority module is invalid');
      const value = await (
        loaded as OwnerAcceptanceAuthorityModule
      ).resolveOwnerAcceptanceAuthority();
      const parsed = OwnerAcceptanceSchema.safeParse(value);
      if (!parsed.success)
        throw new Error(
          'owner acceptance authority module returned invalid data'
        );
      return parsed.data;
    }
  );
  return () => authoritative;
}

export async function loadQualificationArtifactAuthority(
  environment: Readonly<Record<string, string | undefined>>,
  toolingMergeSha: string
): Promise<QualificationArtifactAuthority> {
  const workspaceRoot = environment.EVIDENCE_WORKSPACE_ROOT;
  const path = environment.EVIDENCE_ARTIFACT_AUTHORITY_MODULE;
  const sha256 = environment.EVIDENCE_ARTIFACT_AUTHORITY_MODULE_SHA256;
  if (!workspaceRoot || !path || !sha256)
    throw new Error('reviewed qualification artifact authority is required');
  const verified = await verifyReviewedEvidenceRunnerModule(
    workspaceRoot,
    toolingMergeSha,
    { path, sha256 }
  );
  return importReviewedEvidenceModule(
    workspaceRoot,
    verified.path,
    verified.files,
    async (loaded) => {
      if (
        !loaded ||
        typeof loaded !== 'object' ||
        !('resolveQualificationArtifactAuthority' in loaded) ||
        typeof (loaded as Partial<QualificationArtifactAuthorityModule>)
          .resolveQualificationArtifactAuthority !== 'function'
      )
        throw new Error('qualification artifact authority module is invalid');
      const value = await (
        loaded as QualificationArtifactAuthorityModule
      ).resolveQualificationArtifactAuthority();
      const parsed = QualificationArtifactAuthoritySchema.safeParse(value);
      if (!parsed.success || parsed.data.toolingMergeSha !== toolingMergeSha)
        throw new Error(
          'qualification artifact authority module returned invalid data'
        );
      return parsed.data;
    }
  );
}
