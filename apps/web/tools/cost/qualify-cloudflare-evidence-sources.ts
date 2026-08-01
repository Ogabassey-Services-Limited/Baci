import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  calculateCanonicalSha256,
  canonicalizeJson,
} from '../../../../packages/shared/src/storefront/delivery-evidence';
import { cloudflareEvidencePrepare } from './cloudflare-evidence-prepare';

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
    request: Readonly<{
      endpoint: string;
      zoneId: string;
      requestSchemaSha256: string;
      body: Readonly<{ hosts: readonly ['edge-evidence.ogabassey.com'] }>;
    }>
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

export function calculatePointerCacheCanonicalSha256(
  value: Omit<z.infer<typeof PointerCacheSchema>, 'canonicalSha256'>
) {
  return calculateCanonicalSha256(canonicalizeJson(value));
}

export function parseQualificationArguments(args: readonly string[]) {
  if (args[0] === '--prepare')
    throw new Error('prepare options require the functional prepare parser');
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
  value: unknown,
  options: Readonly<{ now?: Date; maximumAgeSeconds?: number }> = {}
):
  | { ok: true; qualification: CloudflareWorkerArtifactReadbackQualification }
  | { ok: false; reason: string } {
  const parsed = ArtifactReadbackSchema.safeParse(value);
  if (!parsed.success) return { ok: false, reason: 'readback_schema_invalid' };
  const receipt = parsed.data;
  const prefixMatch = receipt.versions[0]?.endpoint.match(
    /^(\/accounts\/[^/]+\/workers\/scripts\/[^/]+)\/versions\/[^/]+$/
  );
  if (!prefixMatch)
    return { ok: false, reason: 'scripts_versions_endpoint_invalid' };
  const prefix = prefixMatch[1];
  if (prefix.split('/').at(-1) !== receipt.scriptName)
    return { ok: false, reason: 'scripts_versions_endpoint_invalid' };
  if (
    !receipt.versions.every(
      (version) =>
        version.endpoint === `${prefix}/versions/${version.versionId}`
    )
  )
    return { ok: false, reason: 'scripts_versions_endpoint_invalid' };
  if (receipt.deploymentsEndpoint !== `${prefix}/deployments`)
    return { ok: false, reason: 'deployments_endpoint_invalid' };
  if (
    receipt.versions[0].moduleSha256 === receipt.versions[1].moduleSha256 ||
    receipt.versions[0].settingsSha256 === receipt.versions[1].settingsSha256
  )
    return { ok: false, reason: 'artifacts_not_distinguishable' };
  const nowMs = (options.now ?? new Date()).valueOf();
  const qualifiedAt = new Date(receipt.pointerCache.qualifiedAt).valueOf();
  const expiresAt = new Date(receipt.pointerCache.expiresAt).valueOf();
  const maximumAgeSeconds = options.maximumAgeSeconds ?? 24 * 60 * 60;
  if (
    ![nowMs, qualifiedAt, expiresAt].every(Number.isFinite) ||
    expiresAt < qualifiedAt ||
    qualifiedAt > nowMs ||
    expiresAt <= nowMs ||
    nowMs - qualifiedAt > maximumAgeSeconds * 1000
  )
    return { ok: false, reason: 'pointer_cache_qualification_expired' };
  const { canonicalSha256: _ignored, ...withoutHash } = receipt.pointerCache;
  if (
    receipt.pointerCache.canonicalSha256 !==
    calculatePointerCacheCanonicalSha256(withoutHash)
  )
    return { ok: false, reason: 'pointer_cache_fingerprint_invalid' };
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
    zoneId: string;
    pointerProbeCount?: number;
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
  const pointerProbeCount = input.pointerProbeCount ?? 2;
  if (!Number.isInteger(pointerProbeCount) || pointerProbeCount < 2)
    throw new Error('pointer probes must be repeated independently');
  for (const method of ['GET', 'HEAD'] as const)
    for (let index = 0; index < pointerProbeCount; index++) {
      const result = await client.pointerProbe(method, input.pointerUrl);
      if (
        !['DYNAMIC', 'BYPASS'].includes(result.cfCacheStatus) ||
        result.age !== undefined
      )
        throw new Error('pointer cache probe observed a cacheable response');
    }
  const expectedPurgeEndpoint = `/zones/${input.zoneId}/purge_cache`;
  if (input.purge.endpoint !== expectedPurgeEndpoint)
    throw new Error(
      'temporary purge endpoint does not match the journaled zone'
    );
  const purgeBody = Object.freeze({
    hosts: Object.freeze(['edge-evidence.ogabassey.com'] as const),
  });
  const operation = await client.temporaryPurge({
    endpoint: expectedPurgeEndpoint,
    zoneId: input.zoneId,
    requestSchemaSha256: input.purge.requestSchemaSha256,
    body: purgeBody,
  });
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
  for (const name of ['PATH', 'TMPDIR'] as const)
    if (inherited[name]) environment[name] = inherited[name];
  environment[credentialName] = credential;
  return environment;
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  const args = process.argv.slice(2);
  if (args[0] === '--prepare') {
    cloudflareEvidencePrepare
      .run(args, process.env, (value) => process.stdout.write(value))
      .catch((error: unknown) => {
        process.stderr.write(
          `${error instanceof Error ? error.message : 'prepare failed'}\n`
        );
        process.exitCode = 1;
      });
  } else if (args[0] === '--validate-readback') {
    const { receiptPath } = parseQualificationArguments(args);
    readFile(receiptPath, 'utf8')
      .then((value) => {
        const result = qualifyCloudflareEvidenceReadback(JSON.parse(value));
        if (!result.ok) throw new Error(result.reason);
        process.stdout.write(`${JSON.stringify(result.qualification)}\n`);
      })
      .catch((error: unknown) => {
        process.stderr.write(
          `${error instanceof Error ? error.message : 'readback validation failed'}\n`
        );
        process.exitCode = 1;
      });
  } else {
    parseQualificationArguments(args);
  }
}
