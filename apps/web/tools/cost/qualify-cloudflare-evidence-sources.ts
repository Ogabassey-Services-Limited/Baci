import { z } from 'zod';
import {
  type EvidenceRunInput,
  openEvidenceRun,
} from './cloudflare-evidence-run-journal';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const PointerCacheSchema = z
  .object({
    cacheRuleId: z.string().min(1),
    cacheRulesetVersion: z.string().min(1),
    traceExpressionSha256: Hash,
    acceptedCfCacheStatuses: z.array(z.enum(['DYNAMIC', 'BYPASS'])).min(1),
    requestCacheMode: z.literal('no-store'),
    repeatedProbeCount: z.number().int().min(2),
    ageObserved: z.literal(false),
    hitObserved: z.literal(false),
    missObserved: z.literal(false),
    qualifiedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    canonicalSha256: Hash,
  })
  .strict();
const ArtifactReadbackSchema = z
  .object({
    apiFamily: z.literal('scripts-versions'),
    scriptName: z.string().min(1),
    versions: z
      .array(
        z
          .object({
            versionId: z.string().min(1),
            endpoint: z.string().min(1),
            scriptEtag: Hash,
            moduleSha256: Hash,
            settingsSha256: Hash,
          })
          .strict()
      )
      .length(2),
    deploymentsEndpoint: z.string().min(1),
    pointerCache: PointerCacheSchema,
  })
  .strict();
const PurgeContractSchema = z
  .object({
    endpoint: z.string().regex(/^\/zones\/[^/]+\/purge_cache$/),
    requestSchemaSha256: Hash,
    rateLimitFingerprint: Hash,
    policySha256: Hash,
    productionResourceState: z.enum([
      'present_verified',
      'absent_requires_bootstrap',
    ]),
  })
  .strict();
const TopologyEndpointSchema = z
  .object({
    family: z.enum(['worker-custom-domain', 'r2-cors', 'r2-custom-domain']),
    endpoint: z.string().startsWith('/accounts/'),
    requestSchemaSha256: Hash,
    responseSchemaSha256: Hash,
    maximumVisibilitySeconds: z.number().int().positive(),
  })
  .strict();
export type CloudflareWorkerArtifactReadbackQualification = z.infer<
  typeof ArtifactReadbackSchema
>;

export function parseQualificationArguments(args: readonly string[]) {
  if (args.length === 1 && args[0] === '--prepare')
    return { mode: 'prepare' as const };
  if (
    args.length === 2 &&
    args[0] === '--validate-readback' &&
    args[1].startsWith('/')
  )
    return { mode: 'validate-readback' as const, receiptPath: args[1] };
  throw new Error(
    'qualification is credentialless and accepts only --prepare or --validate-readback <absolute-receipt>'
  );
}

/** Validates a read-only Scripts Versions/Deployments and pointer-cache receipt. */
export function qualifyCloudflareEvidenceReadback(
  value: unknown
):
  | { ok: true; qualification: CloudflareWorkerArtifactReadbackQualification }
  | { ok: false; reason: string } {
  const parsed = ArtifactReadbackSchema.safeParse(value);
  if (!parsed.success) return { ok: false, reason: 'readback_schema_invalid' };
  const receipt = parsed.data;
  const prefix = `/accounts/`;
  if (
    !receipt.versions.every(
      (version) =>
        version.endpoint.startsWith(prefix) &&
        version.endpoint.endsWith(`/versions/${version.versionId}`)
    )
  )
    return { ok: false, reason: 'scripts_versions_endpoint_invalid' };
  if (
    !receipt.deploymentsEndpoint.startsWith(prefix) ||
    !receipt.deploymentsEndpoint.endsWith('/deployments')
  )
    return { ok: false, reason: 'deployments_endpoint_invalid' };
  if (
    receipt.versions[0].moduleSha256 === receipt.versions[1].moduleSha256 ||
    receipt.versions[0].settingsSha256 === receipt.versions[1].settingsSha256
  )
    return { ok: false, reason: 'artifacts_not_distinguishable' };
  return { ok: true, qualification: receipt };
}
export function qualifyCloudflareReleasePurgeContract(value: unknown) {
  const parsed = PurgeContractSchema.safeParse(value);
  return parsed.success
    ? { ok: true as const, contract: parsed.data }
    : { ok: false as const, reason: 'purge_contract_invalid' };
}
export function qualifyCloudflareTopologyEndpoints(value: unknown) {
  const parsed = z
    .object({ endpoints: z.array(TopologyEndpointSchema).min(1) })
    .strict()
    .safeParse(value);
  return parsed.success
    ? { ok: true as const, contract: parsed.data }
    : { ok: false as const, reason: 'topology_contract_invalid' };
}

/** Builds the environment for one isolated child process; no parent retains both credentials. */
export function buildClosedEvidenceProcessEnvironment(
  credentialName: 'CLOUDFLARE_WRITE_TOKEN' | 'CLOUDFLARE_READ_TOKEN',
  credential: string,
  inherited: Readonly<Record<string, string | undefined>>
) {
  if (inherited.CLOUDFLARE_WRITE_TOKEN && inherited.CLOUDFLARE_READ_TOKEN)
    throw new Error('evidence process inherited both credentials');
  const environment: Record<string, string> = {};
  for (const name of ['PATH', 'HOME', 'TMPDIR'] as const)
    if (inherited[name]) environment[name] = inherited[name];
  environment[credentialName] = credential;
  return environment;
}

/** Creates the journal only; this command never receives a Cloudflare credential. */
export async function prepareCloudflareEvidenceRun(
  stateDir: string,
  input: EvidenceRunInput
) {
  const journal = await openEvidenceRun(stateDir, input);
  return { runId: journal.runId, nextPhase: 'mutate' as const };
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  parseQualificationArguments(process.argv.slice(2));
  throw new Error(
    'prepare requires an approved journal input from the operator runbook'
  );
}
