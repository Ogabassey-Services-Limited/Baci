import type { z } from 'zod';
import type { TopologyEndpointSchema } from './cloudflare-evidence-qualification-schemas';
import {
  PurgeContractSchema,
  sameCloudflarePurgeContract,
} from './cloudflare-evidence-qualification-schemas';
import type {
  CloudflareOrdinaryTrafficProof,
  CloudflareProtectedOverrideProof,
  CloudflareZeroWeightContract,
} from './cloudflare-evidence-qualification-traffic';

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

export type CloudflareQualificationClient = Readonly<{
  listVersions: (
    accountId: string,
    scriptName: string
  ) => Promise<readonly string[]>;
  readVersion(
    accountId: string,
    scriptName: string,
    versionId: string
  ): Promise<ExpectedQualificationArtifact>;
  readDeployments(
    accountId: string,
    scriptName: string
  ): Promise<CloudflareDeploymentReadback>;
  readZeroWeightContract(
    accountId: string,
    scriptName: string
  ): Promise<CloudflareZeroWeightContract>;
  readOrdinaryTrafficProof(
    accountId: string,
    scriptName: string,
    versionIds: readonly [string, string]
  ): Promise<CloudflareOrdinaryTrafficProof>;
  readProtectedVersionOverrideProof(
    accountId: string,
    scriptName: string,
    candidateVersionId: string
  ): Promise<CloudflareProtectedOverrideProof>;
  trace(url: string): Promise<CloudflareTraceReadback>;
  pointerProbe(
    method: 'GET' | 'HEAD',
    url: string
  ): Promise<CloudflarePointerProbeReadback>;
  readPurgeContract(): Promise<z.infer<typeof PurgeContractSchema>>;
  temporaryPurge(
    request: CloudflarePurgeRequest
  ): Promise<Readonly<{ operationId: string }>>;
  readPurge(operationId: string): Promise<'complete' | 'lost_response'>;
  readPurgeReadback?(
    request: CloudflarePurgeReadbackRequest
  ): Promise<CloudflarePurgeReadback>;
  topologyConverged(
    topology: z.infer<typeof TopologyEndpointSchema>
  ): Promise<boolean>;
}>;

export type CloudflareTraceExpectation = Readonly<{
  cacheRuleId: string;
  rulesetVersion: string;
  expressionSha256: string;
}>;

export type CloudflareTraceReadback = Readonly<
  CloudflareTraceExpectation & { matched: boolean }
>;

export type CloudflarePurgeRequest = Readonly<{
  endpoint: string;
  zoneId: string;
  requestSchemaSha256: string;
  rateLimitFingerprint: string;
  policySha256: string;
  body: Readonly<{ hosts: readonly ['edge-evidence.ogabassey.com'] }>;
}>;

export type CloudflarePurgeReadbackRequest = CloudflarePurgeRequest &
  Readonly<{ operationId: string }>;

export type CloudflarePurgeReadback = CloudflarePurgeReadbackRequest &
  Readonly<{ status: 'complete' }>;

export type CloudflarePointerProbeReadback = Readonly<{
  status: number;
  cfCacheStatus: string;
  age?: string;
  headers: Readonly<Record<string, string>>;
}>;

export type CloudflarePointerProbeExpectation = Readonly<{
  bundle: string;
  version: string;
}>;

function readHeader(headers: Readonly<Record<string, string>>, name: string) {
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );
  return entry?.[1];
}

export function matchesCloudflareTrace(
  readback: Readonly<{
    matched: boolean;
    cacheRuleId?: string;
    rulesetVersion?: string;
    expressionSha256?: string;
  }>,
  expected: CloudflareTraceExpectation | undefined
) {
  return (
    expected !== undefined &&
    readback.matched &&
    readback.cacheRuleId === expected.cacheRuleId &&
    readback.rulesetVersion === expected.rulesetVersion &&
    readback.expressionSha256 === expected.expressionSha256
  );
}

export function matchesCloudflarePurgeReadback(
  readback: CloudflarePurgeReadback,
  request: CloudflarePurgeReadbackRequest
) {
  return (
    readback.status === 'complete' &&
    readback.operationId === request.operationId &&
    readback.endpoint === request.endpoint &&
    readback.zoneId === request.zoneId &&
    readback.requestSchemaSha256 === request.requestSchemaSha256 &&
    readback.rateLimitFingerprint === request.rateLimitFingerprint &&
    readback.policySha256 === request.policySha256 &&
    readback.body.hosts.length === 1 &&
    readback.body.hosts[0] === request.body.hosts[0]
  );
}

export function matchesCloudflarePurgeContractReadback(
  readback: unknown,
  expected: z.infer<typeof PurgeContractSchema>
) {
  const parsed = PurgeContractSchema.safeParse(readback);
  return parsed.success && sameCloudflarePurgeContract(parsed.data, expected);
}

export function matchesCloudflarePointerProbe(
  readback: CloudflarePointerProbeReadback,
  expected: CloudflarePointerProbeExpectation
) {
  return (
    readback.status === 204 &&
    readback.cfCacheStatus === 'DYNAMIC' &&
    readback.age === undefined &&
    readHeader(readback.headers, 'X-Baci-Evidence-Bundle') ===
      expected.bundle &&
    readHeader(readback.headers, 'X-Baci-Evidence-Version') === expected.version
  );
}
