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
const QUALIFICATION_EVIDENCE_HOST = new URL(QUALIFICATION_POINTER_URL).hostname;
type TopologyEndpoint = z.infer<typeof TopologyEndpointSchema>;

function endpointParts(endpoint: string) {
  return endpoint.split('/').filter(Boolean);
}

function hasExpectedShape(endpoint: TopologyEndpoint) {
  const parts = endpointParts(endpoint.endpoint);
  if (parts[0] !== 'accounts' || !parts[1]) return false;
  if (endpoint.family === 'worker-custom-domain')
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
  if (endpoint.family === 'r2-cors')
    return parts.length === 6 && parts[5] === 'cors';
  return (
    parts.length === 8 &&
    parts[5] === 'domains' &&
    parts[6] === 'custom' &&
    parts[7] === QUALIFICATION_EVIDENCE_HOST
  );
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
  return { ok: true as const, contract: parsed.data };
}
