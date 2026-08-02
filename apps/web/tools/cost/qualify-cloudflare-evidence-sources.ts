import { pathToFileURL } from 'node:url';
import type { z } from 'zod';
import { calculateQualificationArtifactModuleListSha256 } from './cloudflare-evidence-qualification-artifact';
import { runQualificationCliFromProcess } from './cloudflare-evidence-qualification-cli';
import {
  PurgeContractSchema,
  QUALIFICATION_EVIDENCE_HOST,
  QUALIFICATION_POINTER_PROBE_COUNT,
  QUALIFICATION_POINTER_URL,
} from './cloudflare-evidence-qualification-schemas';
import type {
  CloudflareOwnerAcceptance,
  CloudflareOwnerAcceptanceAuthorityResolver,
  CloudflareZeroWeightContract,
} from './cloudflare-evidence-qualification-traffic';
import { qualifyCloudflareZeroWeightReadback } from './cloudflare-evidence-qualification-traffic';
import {
  type CloudflareQualificationTopology,
  qualifyCloudflareQualificationTopology,
} from './cloudflare-evidence-topology-contract';
import {
  type CloudflarePurgeRequest,
  type CloudflareQualificationClient,
  type CloudflareTraceExpectation,
  type ExpectedQualificationArtifact,
  type JournaledPurgeContract,
  matchesCloudflarePointerProbe,
  matchesCloudflarePurgeContractReadback,
  matchesCloudflarePurgeReadback,
  matchesCloudflareTrace,
  sameCloudflarePurgeContract,
} from './qualify-cloudflare-evidence-sources-contracts';

export {
  buildClosedEvidenceProcessEnvironment,
  parseQualificationArguments,
  REVIEWED_EVIDENCE_SYSTEM_PATH,
  reviewedEvidenceLauncherSearchPath,
  runQualificationCliFromProcess,
} from './cloudflare-evidence-qualification-cli';
export {
  type CloudflareWorkerArtifactReadbackQualification,
  calculatePointerCacheCanonicalSha256,
  QUALIFICATION_POINTER_PROBE_COUNT,
  QUALIFICATION_POINTER_URL,
  QUALIFICATION_WORKER_NAME,
  qualifyCloudflareEvidenceReadback,
  type ReviewedQualificationArtifact,
} from './cloudflare-evidence-qualification-schemas';
export {
  type CloudflareOrdinaryTrafficProof,
  type CloudflareOwnerAcceptance,
  type CloudflareOwnerAcceptanceAuthorityResolver,
  type CloudflareProtectedOverrideProof,
  type CloudflareZeroWeightContract,
  type CloudflareZeroWeightDeployment,
  type CloudflareZeroWeightProof,
  OrdinaryTrafficProofSchema,
  OwnerAcceptanceSchema,
  ProtectedOverrideProofSchema,
  qualifyCloudflareZeroWeightReadback,
  validateCloudflareZeroWeightProof,
  ZeroWeightContractSchema,
  ZeroWeightDeploymentTupleSchema,
  ZeroWeightProofSchema,
} from './cloudflare-evidence-qualification-traffic';
export type {
  CloudflareDeploymentReadback,
  CloudflareDeploymentVersion,
  CloudflareQualificationClient,
  ExpectedQualificationArtifact,
  JournaledPurgeContract,
} from './qualify-cloudflare-evidence-sources-contracts';

export function qualifyCloudflareReleasePurgeContract(value: unknown) {
  const parsed = PurgeContractSchema.safeParse(value);
  return parsed.success
    ? { ok: true as const, contract: parsed.data }
    : { ok: false as const, reason: 'purge_contract_invalid' };
}
export { qualifyCloudflareTopologyEndpoints } from './cloudflare-evidence-topology-contract';
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
    /** The complete shared-scope topology contract, one endpoint per family. */
    topology: CloudflareQualificationTopology;
    zoneId: string;
    ownerAcceptance: CloudflareOwnerAcceptance;
    ownerAcceptanceAuthority: CloudflareOwnerAcceptanceAuthorityResolver;
    trace: CloudflareTraceExpectation;
    expectedOwnerApprovalId: string;
    expectedZeroWeightContract: CloudflareZeroWeightContract;
    now?: Date;
    pointerProbeCount?: number;
  }>
) {
  const parsedTopology = qualifyCloudflareQualificationTopology(
    input.topology,
    input.accountId
  );
  if (!parsedTopology.ok)
    throw new Error(
      'topology contract is not the complete bounded journaled resource set'
    );
  const parsedPurge = PurgeContractSchema.safeParse(input.purge);
  const parsedJournaledPurge = PurgeContractSchema.safeParse(
    input.journaledPurge?.contract
  );
  if (
    !parsedPurge.success ||
    !parsedJournaledPurge.success ||
    input.journaledPurge?.zoneId !== input.zoneId ||
    !sameCloudflarePurgeContract(parsedPurge.data, parsedJournaledPurge.data)
  )
    throw new Error('purge request schema and policy are not journaled');
  if (typeof client.readPurgeContract !== 'function')
    throw new Error('purge provider contract readback is required');
  const providerPurgeContract = await client.readPurgeContract();
  if (
    !matchesCloudflarePurgeContractReadback(
      providerPurgeContract,
      parsedPurge.data
    ) ||
    !matchesCloudflarePurgeContractReadback(
      providerPurgeContract,
      parsedJournaledPurge.data
    )
  )
    throw new Error(
      'purge provider contract does not bind the journaled policy fingerprints'
    );
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
      actual.moduleListSha256 !== artifact.moduleListSha256 ||
      calculateQualificationArtifactModuleListSha256(actual.modules) !==
        actual.moduleListSha256 ||
      calculateQualificationArtifactModuleListSha256(artifact.modules) !==
        artifact.moduleListSha256 ||
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
  const zeroWeightContract = await client.readZeroWeightContract(
    input.accountId,
    input.scriptName
  );
  const ordinaryTraffic = await client.readOrdinaryTrafficProof(
    input.accountId,
    input.scriptName,
    [input.artifacts[0].versionId, input.artifacts[1].versionId]
  );
  const protectedOverride = await client.readProtectedVersionOverrideProof(
    input.accountId,
    input.scriptName,
    input.artifacts[1].versionId
  );
  const zeroWeightQualification = qualifyCloudflareZeroWeightReadback({
    contract: zeroWeightContract,
    deployment: deployments,
    ordinaryTraffic,
    protectedOverride,
    ownerAcceptance: input.ownerAcceptance,
    stableVersionId: input.artifacts[0].versionId,
    candidateVersionId: input.artifacts[1].versionId,
    expectedOwnerApprovalId: input.expectedOwnerApprovalId,
    ownerAcceptanceAuthority: input.ownerAcceptanceAuthority,
    expectedContract: input.expectedZeroWeightContract,
    now: input.now,
  });
  if (!zeroWeightQualification.ok)
    throw new Error(
      `zero-weight qualification failed: ${zeroWeightQualification.reason}`
    );
  if (input.pointerUrl !== QUALIFICATION_POINTER_URL)
    throw new Error(
      'pointer URL does not bind the evidence qualification host'
    );
  const trace = await client.trace(QUALIFICATION_POINTER_URL);
  if (!matchesCloudflareTrace(trace, input.trace))
    throw new Error('Trace did not bind the exact cache rule and expression');
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
      if (
        !matchesCloudflarePointerProbe(result, {
          bundle: 'version-a-204',
          version: input.artifacts[0].versionId,
        })
      )
        throw new Error(
          'pointer cache probe did not reach the reviewed qualification fixture or observed a cacheable response'
        );
    }
  const expectedPurgeEndpoint = `/zones/${input.zoneId}/purge_cache`;
  if (input.purge.endpoint !== expectedPurgeEndpoint)
    throw new Error(
      'temporary purge endpoint does not match the journaled zone'
    );
  const purgeBody = Object.freeze({
    hosts: Object.freeze([QUALIFICATION_EVIDENCE_HOST] as const),
  });
  const purgeRequest: CloudflarePurgeRequest = {
    endpoint: expectedPurgeEndpoint,
    zoneId: input.zoneId,
    requestSchemaSha256: parsedJournaledPurge.data.requestSchemaSha256,
    rateLimitFingerprint: parsedJournaledPurge.data.rateLimitFingerprint,
    policySha256: parsedJournaledPurge.data.policySha256,
    body: purgeBody,
  };
  const operation = await client.temporaryPurge(purgeRequest);
  if (
    typeof operation.operationId !== 'string' ||
    operation.operationId.trim().length === 0
  )
    throw new Error('temporary purge did not return a nonempty operation ID');
  const operationId = operation.operationId;
  const purgeStatus = await client.readPurge(operationId);
  if (purgeStatus !== 'complete' && purgeStatus !== 'lost_response')
    throw new Error('temporary purge outcome is ambiguous');
  if (!client.readPurgeReadback)
    throw new Error(
      'temporary purge status requires purge-specific readback or bound before/after cache probe'
    );
  const purgeReadbackRequest = { ...purgeRequest, operationId };
  const purgeReadback = await client.readPurgeReadback(purgeReadbackRequest);
  if (!matchesCloudflarePurgeReadback(purgeReadback, purgeReadbackRequest))
    throw new Error('temporary purge readback does not bind the purge request');
  for (const topology of parsedTopology.contract.endpoints)
    if (!(await client.topologyConverged(topology)))
      throw new Error('topology did not converge within the journaled bound');
  return {
    purgeStatus,
    qualified: true as const,
    zeroWeightProof: zeroWeightQualification.proof,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runQualificationCliFromProcess();
