import type { z } from 'zod';
import type { PurgeContractSchema } from './cloudflare-evidence-qualification-schemas';

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
  body: Readonly<{ hosts: readonly ['edge-evidence.ogabassey.com'] }>;
}>;

export type CloudflarePurgeReadbackRequest = CloudflarePurgeRequest &
  Readonly<{ operationId: string }>;

export type CloudflarePurgeReadback = CloudflarePurgeReadbackRequest &
  Readonly<{ status: 'complete' }>;

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
    readback.body.hosts.length === 1 &&
    readback.body.hosts[0] === request.body.hosts[0]
  );
}
