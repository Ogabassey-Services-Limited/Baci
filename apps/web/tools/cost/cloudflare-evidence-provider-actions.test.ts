import { describe, expect, it } from 'vitest';
import {
  type DeepQualificationClient,
  executeDeepCloudflareEvidenceQualification,
  type JournaledTopologyEndpoint,
  type TopologyFamily,
  type TopologyMutationRequest,
  type TopologyPlan,
} from './cloudflare-evidence-provider-qualification';

const families = [
  'worker-custom-domain',
  'r2-cors',
  'r2-custom-domain',
] as const;
const tuple = (family: TopologyFamily, state: string) => ({
  state,
  fingerprint: `${family}-${state}`,
});
const topologies = families.map((family) => ({
  family,
  action: family === 'r2-cors' ? ('write' as const) : ('detach' as const),
  endpoint:
    family === 'worker-custom-domain'
      ? '/accounts/account/workers/scripts/baci-evidence-qualification/domains/custom/edge-evidence.ogabassey.com'
      : family === 'r2-cors'
        ? '/accounts/account/r2/buckets/evidence/cors'
        : '/accounts/account/r2/buckets/evidence/domains/custom/edge-evidence.ogabassey.com',
  requestSchemaSha256: 'b'.repeat(64),
  responseSchemaSha256: 'c'.repeat(64),
  maximumVisibilitySeconds: 60,
  before: tuple(family, 'before'),
  intermediate: tuple(family, 'intermediate'),
  after: tuple(family, 'after'),
  restore: {
    action: family === 'r2-cors' ? ('write' as const) : ('reattach' as const),
    requestSchemaSha256: 'd'.repeat(64),
    responseSchemaSha256: 'e'.repeat(64),
  },
}));
const topologyPlans = topologies as unknown as readonly [
  TopologyPlan,
  TopologyPlan,
  TopologyPlan,
];
const journaledTopologyPlans = families.map((family) => {
  const topology = topologies.find((item) => item.family === family);
  return {
    family,
    action: topology?.action,
    endpoint: topology?.endpoint ?? '',
    requestSchemaSha256: 'b'.repeat(64),
    responseSchemaSha256: 'c'.repeat(64),
    maximumVisibilitySeconds: topology?.maximumVisibilitySeconds,
    before: topology?.before,
    intermediate: topology?.intermediate,
    after: topology?.after,
    restore: topology?.restore,
  };
}) as unknown as readonly [
  JournaledTopologyEndpoint,
  JournaledTopologyEndpoint,
  JournaledTopologyEndpoint,
];
const asTopologyPlans = (values: readonly TopologyPlan[]) =>
  values as unknown as typeof topologyPlans;
const asJournaledTopologyPlans = (
  values: readonly JournaledTopologyEndpoint[]
) => values as unknown as typeof journaledTopologyPlans;
const input = {
  pointerUrl: 'https://edge-evidence.ogabassey.com/__baci-evidence/a',
  pointerProbeCount: 2,
  trace: {
    cacheRuleId: 'rule',
    rulesetVersion: 'v1',
    expressionSha256: 'a'.repeat(64),
  },
  topologies: topologyPlans,
  journaledTopologies: journaledTopologyPlans,
};
function client(
  topologyMutate: DeepQualificationClient['topologyMutate'] = async ({
    family,
  }) => ({
    operationId: `${family}-operation`,
    lostResponse: family === 'r2-cors',
  })
) {
  return {
    trace: async () => ({ ...input.trace, matched: true }),
    pointerProbe: async () => ({ cfCacheStatus: 'DYNAMIC' }),
    topologyRead: async (family: TopologyFamily) => tuple(family, 'before'),
    topologyMutate,
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
  };
}

describe('Cloudflare topology mutation actions', () => {
  it('binds fixed family actions to forward and inverse restore requests', async () => {
    const requests: TopologyMutationRequest[] = [];
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client(async (request) => {
          requests.push(request);
          return {
            operationId: `${request.family}-${requests.length}`,
            lostResponse: request.family === 'r2-cors',
          };
        }) as never,
        input
      )
    ).resolves.toMatchObject({ qualified: true });
    expect(requests).toEqual(
      topologies.flatMap((topology) => [
        {
          family: topology.family,
          action: topology.action,
          endpoint: topology.endpoint,
          requestSchemaSha256: topology.requestSchemaSha256,
        },
        {
          family: topology.family,
          action: topology.restore.action,
          endpoint: topology.endpoint,
          requestSchemaSha256: topology.restore.requestSchemaSha256,
        },
      ])
    );
  });

  it.each([
    ['worker-custom-domain', 'write'],
    ['r2-cors', 'detach'],
    ['r2-custom-domain', 'write'],
  ] as const)('rejects %s when its action is %s instead of the fixed family action', async (family, wrongAction) => {
    const invalid = {
      ...input,
      topologies: asTopologyPlans(
        input.topologies.map((topology) =>
          topology.family === family
            ? { ...topology, action: wrongAction }
            : topology
        )
      ),
      journaledTopologies: asJournaledTopologyPlans(
        input.journaledTopologies.map((topology) =>
          topology.family === family
            ? { ...topology, action: wrongAction }
            : topology
        )
      ),
    };
    let mutationCalls = 0;
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client(async () => {
          mutationCalls += 1;
          return { operationId: 'unexpected', lostResponse: false };
        }) as never,
        invalid
      )
    ).rejects.toThrow('fixed family-to-action mapping');
    expect(mutationCalls).toBe(0);
  });
});
