import type {
  DeepQualificationClient,
  executeDeepCloudflareEvidenceQualification,
  JournaledTopologyEndpoint,
  TopologyAction,
  TopologyFamily,
  TopologyMutationRequest,
  TopologyPlan,
} from './cloudflare-evidence-provider-qualification';

const families = [
  'worker-custom-domain',
  'r2-cors',
  'r2-custom-domain',
] as const;
export const tuple = (family: TopologyFamily, state: string) => ({
  state,
  fingerprint: `${family}-${state}`,
});
const makeTopology = (
  family: TopologyFamily,
  action: TopologyAction,
  endpoint: string
) =>
  ({
    family,
    action,
    endpoint,
    requestSchemaSha256: 'b'.repeat(64),
    responseSchemaSha256: 'c'.repeat(64),
    maximumVisibilitySeconds: 60,
    before: tuple(family, 'before'),
    intermediate: tuple(family, 'intermediate'),
    after: tuple(family, 'after'),
    restore: {
      action: action === 'detach' ? 'reattach' : 'write',
      requestSchemaSha256: 'd'.repeat(64),
      responseSchemaSha256: 'e'.repeat(64),
    },
  }) satisfies TopologyPlan;
const topologyPlans = [
  makeTopology(
    families[0],
    'detach',
    '/accounts/account/workers/scripts/baci-evidence-qualification/domains/custom/edge-evidence.ogabassey.com'
  ),
  makeTopology(
    'r2-cors',
    'write',
    '/accounts/account/r2/buckets/evidence/cors'
  ),
  makeTopology(
    families[2],
    'detach',
    '/accounts/account/r2/buckets/evidence/domains/custom/edge-evidence.ogabassey.com'
  ),
] as const;
const makeJournaledTopology = (
  topology: TopologyPlan
): JournaledTopologyEndpoint => ({
  family: topology.family,
  action: topology.action,
  endpoint: topology.endpoint,
  requestSchemaSha256: topology.requestSchemaSha256,
  responseSchemaSha256: topology.responseSchemaSha256,
  maximumVisibilitySeconds: topology.maximumVisibilitySeconds,
  before: topology.before,
  intermediate: topology.intermediate,
  after: topology.after,
  restore: topology.restore,
});
const journaledTopologyPlans = [
  makeJournaledTopology(topologyPlans[0]),
  makeJournaledTopology(topologyPlans[1]),
  makeJournaledTopology(topologyPlans[2]),
] as const;
export const input = {
  pointerUrl: 'https://edge-evidence.ogabassey.com/__baci-evidence/a',
  pointerProbeCount: 2,
  trace: {
    cacheRuleId: 'rule',
    rulesetVersion: 'v1',
    expressionSha256: 'a'.repeat(64),
  },
  topologies: topologyPlans,
  journaledTopologies: journaledTopologyPlans,
} satisfies Parameters<typeof executeDeepCloudflareEvidenceQualification>[1];
export function client(
  overrides: Partial<DeepQualificationClient> = {}
): DeepQualificationClient {
  return {
    trace: async () => ({ ...input.trace, matched: true }),
    pointerProbe: async () => ({ cfCacheStatus: 'DYNAMIC' }),
    topologyRead: async (family: TopologyFamily) => tuple(family, 'before'),
    topologyMutate: ({
      family,
      requestSchemaSha256,
    }: TopologyMutationRequest) => {
      const topology = topologyPlans.find(
        (candidate) => candidate.family === family
      );
      if (!topology) throw new Error(`missing topology fixture for ${family}`);
      const restoring =
        requestSchemaSha256 === topology.restore.requestSchemaSha256;
      return Promise.resolve({
        operationId: `${family}-operation`,
        lostResponse: family === 'r2-cors',
        responseSchemaSha256: restoring
          ? topology.restore.responseSchemaSha256
          : topology.responseSchemaSha256,
      });
    },
    topologyPoll: async (family: TopologyFamily) => [
      {
        tuple: tuple(family, 'intermediate'),
        pendingOperation: true,
        elapsedSeconds: 1,
      },
      {
        tuple: tuple(family, 'after'),
        pendingOperation: false,
        elapsedSeconds: 2,
      },
    ],
    topologyControlReadback: async (family: TopologyFamily) => [
      {
        tuple: tuple(family, 'before'),
        pendingOperation: false,
        elapsedSeconds: 0,
      },
      {
        tuple: tuple(family, 'before'),
        pendingOperation: false,
        elapsedSeconds: 60,
      },
    ],
    ...overrides,
  };
}
