import { z } from 'zod';
import {
  QUALIFICATION_POINTER_URL,
  QUALIFICATION_WORKER_NAME,
  TopologyEndpointSchema,
} from './cloudflare-evidence-qualification-schemas';

const TOPOLOGY_FAMILIES = [
  'worker-custom-domain',
  'r2-cors',
  'r2-custom-domain',
] as const;
export type CloudflareTopologyFamily = (typeof TOPOLOGY_FAMILIES)[number];
const QUALIFICATION_EVIDENCE_HOST = new URL(QUALIFICATION_POINTER_URL).hostname;
type TopologyEndpoint = z.infer<typeof TopologyEndpointSchema>;
export type CloudflareQualificationTopology = readonly [
  TopologyEndpoint,
  TopologyEndpoint,
  TopologyEndpoint,
];

export function cloudflareTopologyEndpointParts(endpoint: string) {
  const rawParts = endpoint.split('/');
  if (
    rawParts[0] !== '' ||
    rawParts.length < 2 ||
    rawParts.at(-1) === '' ||
    rawParts.slice(1).some((part) => part === '')
  )
    return [];
  return rawParts.slice(1);
}

export function verifyCloudflareTopologyEndpointFamily(
  endpoint: string,
  family: string
) {
  if (!TOPOLOGY_FAMILIES.some((knownFamily) => knownFamily === family))
    return false;
  const parts = cloudflareTopologyEndpointParts(endpoint);
  if (parts[0] !== 'accounts' || !parts[1]) return false;
  if (family === 'worker-custom-domain')
    return (
      parts.length === 8 &&
      parts[2] === 'workers' &&
      parts[3] === 'scripts' &&
      parts[4] === QUALIFICATION_WORKER_NAME &&
      parts[5] === 'domains' &&
      parts[6] === 'custom' &&
      parts[7] === QUALIFICATION_EVIDENCE_HOST
    );
  if (parts[2] !== 'r2' || parts[3] !== 'buckets' || !parts[4]) return false;
  if (family === 'r2-cors') return parts.length === 6 && parts[5] === 'cors';
  return (
    parts.length === 8 &&
    parts[5] === 'domains' &&
    parts[6] === 'custom' &&
    parts[7] === QUALIFICATION_EVIDENCE_HOST
  );
}
function hasExpectedShape(endpoint: TopologyEndpoint) {
  return verifyCloudflareTopologyEndpointFamily(
    endpoint.endpoint,
    endpoint.family
  );
}

export function qualifyCloudflareTopologyEndpoint(
  value: unknown,
  expectedAccountId: string
) {
  const parsed = TopologyEndpointSchema.safeParse(value);
  if (
    !parsed.success ||
    !parsed.data.endpoint.startsWith(`/accounts/${expectedAccountId}/`) ||
    !hasExpectedShape(parsed.data)
  )
    return { ok: false as const, reason: 'topology_contract_invalid' };
  return { ok: true as const, contract: parsed.data };
}

export function qualifyCloudflareTopologyEndpoints(value: unknown) {
  const parsed = z
    .object({ endpoints: z.array(TopologyEndpointSchema).length(3) })
    .strict()
    .safeParse(value);
  if (!parsed.success)
    return { ok: false as const, reason: 'topology_contract_invalid' };
  const families = new Set(parsed.data.endpoints.map(({ family }) => family));
  if (
    families.size !== TOPOLOGY_FAMILIES.length ||
    !TOPOLOGY_FAMILIES.every((family) => families.has(family)) ||
    !parsed.data.endpoints.every(hasExpectedShape)
  )
    return { ok: false as const, reason: 'topology_contract_invalid' };
  const accountIds = new Set(
    parsed.data.endpoints.map(
      (endpoint) => cloudflareTopologyEndpointParts(endpoint.endpoint)[1]
    )
  );
  const bucketNames = new Set(
    parsed.data.endpoints
      .filter(({ family }) => family !== 'worker-custom-domain')
      .map((endpoint) => cloudflareTopologyEndpointParts(endpoint.endpoint)[4])
  );
  if (accountIds.size !== 1 || bucketNames.size !== 1)
    return { ok: false as const, reason: 'topology_contract_invalid' };
  return { ok: true as const, contract: parsed.data };
}

export function qualifyCloudflareQualificationTopology(
  value: CloudflareQualificationTopology,
  expectedAccountId: string
) {
  const parsed = qualifyCloudflareTopologyEndpoints({ endpoints: value });
  if (
    !parsed.ok ||
    parsed.contract.endpoints.some(
      (endpoint) =>
        !endpoint.endpoint.startsWith(`/accounts/${expectedAccountId}/`)
    )
  )
    return {
      ok: false as const,
      reason: 'topology_contract_invalid',
    };
  return parsed;
}
