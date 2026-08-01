import { z } from 'zod';
import { runQualificationCli } from './cloudflare-evidence-qualification-cli';
import {
  type ArtifactReadbackSchema,
  PurgeContractSchema,
  QUALIFICATION_POINTER_PROBE_COUNT,
  QUALIFICATION_POINTER_URL,
  TopologyEndpointSchema,
} from './cloudflare-evidence-qualification-schemas';

export {
  buildClosedEvidenceProcessEnvironment,
  parseQualificationArguments,
} from './cloudflare-evidence-qualification-cli';
export {
  calculatePointerCacheCanonicalSha256,
  QUALIFICATION_POINTER_PROBE_COUNT,
  QUALIFICATION_POINTER_URL,
  QUALIFICATION_WORKER_NAME,
  qualifyCloudflareEvidenceReadback,
  type ReviewedQualificationArtifact,
} from './cloudflare-evidence-qualification-schemas';

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
  ): Promise<CloudflareDeploymentReadback>;
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
export type CloudflareDeploymentVersion = Readonly<{
  versionId: string;
  percentage: number;
}>;
export type CloudflareDeploymentReadback = Readonly<{
  deploymentId: string;
  versions: readonly CloudflareDeploymentVersion[];
}>;
export type JournaledPurgeContract = Readonly<{
  zoneId: string;
  contract: z.infer<typeof PurgeContractSchema>;
}>;

const samePurgeContract = (
  left: z.infer<typeof PurgeContractSchema>,
  right: z.infer<typeof PurgeContractSchema>
) =>
  left.endpoint === right.endpoint &&
  left.requestSchemaSha256 === right.requestSchemaSha256 &&
  left.rateLimitFingerprint === right.rateLimitFingerprint &&
  left.policySha256 === right.policySha256 &&
  left.productionResourceState === right.productionResourceState;

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
    journaledPurge: JournaledPurgeContract;
    topology: z.infer<typeof TopologyEndpointSchema>;
    zoneId: string;
    pointerProbeCount?: number;
  }>
) {
  const parsedPurge = PurgeContractSchema.safeParse(input.purge);
  const parsedJournaledPurge = PurgeContractSchema.safeParse(
    input.journaledPurge?.contract
  );
  if (
    !parsedPurge.success ||
    !parsedJournaledPurge.success ||
    input.journaledPurge?.zoneId !== input.zoneId ||
    !samePurgeContract(parsedPurge.data, parsedJournaledPurge.data)
  )
    throw new Error('purge request schema and policy are not journaled');
  const listed = await client.listVersions(input.accountId, input.scriptName);
  if (
    new Set(listed).size !== 2 ||
    new Set(input.artifacts.map(({ versionId }) => versionId)).size !== 2 ||
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
  if (
    !deployments.deploymentId ||
    deployments.versions.length !== 2 ||
    new Set(deployments.versions.map(({ versionId }) => versionId)).size !== 2
  )
    throw new Error('Deployments does not bind both expected versions');
  const deploymentVersionById = new Map(
    deployments.versions.map((version) => [version.versionId, version])
  );
  const deploymentA = deploymentVersionById.get(input.artifacts[0].versionId);
  const deploymentB = deploymentVersionById.get(input.artifacts[1].versionId);
  if (
    !deploymentA ||
    !deploymentB ||
    deploymentA.percentage !== 100 ||
    deploymentB.percentage !== 0
  )
    throw new Error('Deployments does not bind the exact 100/0 version tuple');
  if (input.pointerUrl !== QUALIFICATION_POINTER_URL)
    throw new Error(
      'pointer URL does not bind the evidence qualification host'
    );
  if (!(await client.trace(QUALIFICATION_POINTER_URL)).matched)
    throw new Error('Trace did not bind the pointer cache rule');
  const pointerProbeCount =
    input.pointerProbeCount ?? QUALIFICATION_POINTER_PROBE_COUNT;
  if (pointerProbeCount !== QUALIFICATION_POINTER_PROBE_COUNT)
    throw new Error('pointer probes must be repeated independently');
  for (const method of ['GET', 'HEAD'] as const)
    for (let index = 0; index < pointerProbeCount; index++) {
      const result = await client.pointerProbe(
        method,
        QUALIFICATION_POINTER_URL
      );
      if (result.cfCacheStatus !== 'DYNAMIC' || result.age !== undefined)
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
    requestSchemaSha256: parsedJournaledPurge.data.requestSchemaSha256,
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

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  void runQualificationCli(process.argv.slice(2), process.env, {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
    setExitCode: (code) => {
      process.exitCode = code;
    },
  });
}
