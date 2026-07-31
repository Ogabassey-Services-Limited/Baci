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
export type CloudflareQualificationClient = Readonly<{
  listVersions(
    accountId: string,
    scriptName: string
  ): Promise<readonly string[]>;
  readVersion(
    accountId: string,
    scriptName: string,
    versionId: string
  ): Promise<
    Readonly<{
      versionId: string;
      scriptEtag: string;
      moduleSha256: string;
      settingsSha256: string;
    }>
  >;
  readDeployments(
    accountId: string,
    scriptName: string
  ): Promise<readonly string[]>;
  trace(url: string): Promise<Readonly<{ matched: boolean }>>;
  pointerProbe(
    method: 'GET' | 'HEAD',
    url: string
  ): Promise<Readonly<{ cfCacheStatus: string; age?: string }>>;
  temporaryPurge(
    endpoint: string,
    requestSchemaSha256: string
  ): Promise<Readonly<{ operationId: string }>>;
  readPurge(operationId: string): Promise<'complete' | 'lost_response'>;
  topologyConverged(maximumVisibilitySeconds: number): Promise<boolean>;
}>;
export type ExpectedQualificationArtifact = Readonly<{
  versionId: string;
  scriptEtag: string;
  moduleSha256: string;
  settingsSha256: string;
}>;

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

/** Executes the bounded, injectable provider readback/pointer/purge qualification. */
export async function executeCloudflareEvidenceQualification(
  client: CloudflareQualificationClient,
  input: Readonly<{
    accountId: string;
    scriptName: string;
    artifacts: readonly [
      ExpectedQualificationArtifact,
      ExpectedQualificationArtifact,
    ];
    pointerUrl: string;
    purge: z.infer<typeof PurgeContractSchema>;
    topology: z.infer<typeof TopologyEndpointSchema>;
  }>
) {
  const listed = await client.listVersions(input.accountId, input.scriptName);
  if (
    new Set(listed).size !== 2 ||
    input.artifacts.some(({ versionId }) => !listed.includes(versionId))
  )
    throw new Error(
      'Scripts Versions list does not bind both expected artifacts'
    );
  for (const artifact of input.artifacts) {
    const actual = await client.readVersion(
      input.accountId,
      input.scriptName,
      artifact.versionId
    );
    if (
      actual.versionId !== artifact.versionId ||
      actual.scriptEtag !== artifact.scriptEtag ||
      actual.moduleSha256 !== artifact.moduleSha256 ||
      actual.settingsSha256 !== artifact.settingsSha256
    )
      throw new Error(
        'Scripts Versions artifact readback does not match local artifact'
      );
  }
  const deployments = await client.readDeployments(
    input.accountId,
    input.scriptName
  );
  if (input.artifacts.some(({ versionId }) => !deployments.includes(versionId)))
    throw new Error('Deployments does not bind both expected versions');
  if (!(await client.trace(input.pointerUrl)).matched)
    throw new Error('Trace did not bind the pointer cache rule');
  for (const method of ['GET', 'HEAD'] as const) {
    const result = await client.pointerProbe(method, input.pointerUrl);
    if (
      !['DYNAMIC', 'BYPASS'].includes(result.cfCacheStatus) ||
      result.age !== undefined
    )
      throw new Error('pointer cache probe observed a cacheable response');
  }
  const operation = await client.temporaryPurge(
    input.purge.endpoint,
    input.purge.requestSchemaSha256
  );
  const purgeStatus = await client.readPurge(operation.operationId);
  if (
    purgeStatus === 'lost_response' &&
    !(await client.topologyConverged(input.topology.maximumVisibilitySeconds))
  )
    throw new Error('temporary purge lost-response topology did not converge');
  if (purgeStatus !== 'complete' && purgeStatus !== 'lost_response')
    throw new Error('temporary purge outcome is ambiguous');
  return { purgeStatus, qualified: true as const };
}

/** Builds the environment for one isolated child process; no parent retains both credentials. */
export function buildClosedEvidenceProcessEnvironment(
  credentialName: 'CLOUDFLARE_WRITE_TOKEN' | 'CLOUDFLARE_READ_TOKEN',
  credential: string,
  inherited: Readonly<Record<string, string | undefined>>
) {
  if (inherited.CLOUDFLARE_WRITE_TOKEN || inherited.CLOUDFLARE_READ_TOKEN)
    throw new Error('evidence process inherited a credential');
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
}
