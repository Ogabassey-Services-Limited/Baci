import { describe, expect, it } from 'vitest';
import {
  executeDeepCloudflareEvidenceQualification,
  type JournaledTopologyEndpoint,
  type TopologyFamily,
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
function client(overrides: Record<string, unknown> = {}) {
  return {
    trace: async () => ({ ...input.trace, matched: true }),
    pointerProbe: async () => ({ cfCacheStatus: 'DYNAMIC' }),
    topologyRead: async (family: TopologyFamily) => tuple(family, 'before'),
    topologyMutate: async ({ family }: Pick<TopologyPlan, 'family'>) => ({
      operationId: `${family}-operation`,
      lostResponse: family === 'r2-cors',
    }),
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
describe('deep Cloudflare provider topology qualification', () => {
  it('polls normal and lost-response mutations to exact after tuples for every family', async () => {
    const result = await executeDeepCloudflareEvidenceQualification(
      client() as never,
      input
    );
    expect(result).toMatchObject({ qualified: true });
    expect(result.mutationReceipts).toHaveLength(3);
    expect(result.mutationReceipts[1]).toMatchObject({
      family: 'r2-cors',
      lostResponse: true,
      responseSchemaSha256: 'c'.repeat(64),
    });
    await expect(
      executeDeepCloudflareEvidenceQualification(client() as never, input)
    ).resolves.toMatchObject({ qualified: true });
  });
  it('rejects an unchanged control tuple while any provider operation is pending', async () => {
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyControlReadback: async (family: TopologyFamily) => [
            {
              tuple: tuple(family, 'before'),
              pendingOperation: true,
              elapsedSeconds: 60,
            },
          ],
        }) as never,
        input
      )
    ).rejects.toThrow('pending');
  });
  it('rejects convergence that applies beyond the qualified visibility bound', async () => {
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyPoll: async (family: TopologyFamily) => [
            {
              tuple: tuple(family, 'intermediate'),
              pendingOperation: true,
              elapsedSeconds: 60,
            },
            {
              tuple: tuple(family, 'after'),
              pendingOperation: false,
              elapsedSeconds: 61,
            },
          ],
        }) as never,
        input
      )
    ).rejects.toThrow('visibility');
  });
  it('rejects mixed or unknown mutation tuples instead of treating them as convergence', async () => {
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyPoll: async (family: TopologyFamily) => [
            {
              tuple: tuple(family, 'unknown'),
              pendingOperation: false,
              elapsedSeconds: 1,
            },
            {
              tuple: tuple(family, 'after'),
              pendingOperation: false,
              elapsedSeconds: 2,
            },
          ],
        }) as never,
        input
      )
    ).rejects.toThrow('tuple');
  });
  it('rejects a topology plan whose before and after tuples are identical', async () => {
    const unchanged = {
      ...input,
      topologies: asTopologyPlans(
        input.topologies.map((topology) =>
          topology.family === 'r2-cors'
            ? { ...topology, after: topology.before }
            : topology
        )
      ),
      journaledTopologies: asJournaledTopologyPlans(
        input.journaledTopologies.map((topology) =>
          topology.family === 'r2-cors'
            ? { ...topology, after: topology.before }
            : topology
        )
      ),
    };
    await expect(
      executeDeepCloudflareEvidenceQualification(client() as never, unchanged)
    ).rejects.toThrow('real mutation');
  });
  it('rejects BYPASS as pointer-cache proof and never forwards an unjournaled URL', async () => {
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          pointerProbe: async () => ({ cfCacheStatus: 'BYPASS' }),
        }) as never,
        input
      )
    ).rejects.toThrow('cacheable');
    await expect(
      executeDeepCloudflareEvidenceQualification(client() as never, {
        ...input,
        pointerUrl: 'https://edge-evidence.ogabassey.com/unreviewed',
      })
    ).rejects.toThrow('pointer URL');
    await expect(
      executeDeepCloudflareEvidenceQualification(client() as never, {
        ...input,
        topologies: input.topologies.map((topology) =>
          topology.family === 'r2-cors'
            ? { ...topology, endpoint: '/accounts/other/r2/buckets/other/cors' }
            : topology
        ) as never,
      })
    ).rejects.toThrow('journaled');
    await expect(
      executeDeepCloudflareEvidenceQualification(client() as never, {
        ...input,
        journaledTopologies: asJournaledTopologyPlans(
          input.journaledTopologies.map((topology) =>
            topology.family === 'r2-cors'
              ? { ...topology, responseSchemaSha256: 'd'.repeat(64) }
              : topology
          )
        ),
      })
    ).rejects.toThrow('journaled');
  });
  it('rejects an ambiguous topology mutation response instead of claiming an audited receipt', async () => {
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyMutate: async () => ({}),
        }) as never,
        input
      )
    ).rejects.toThrow('ambiguous');
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyMutate: async () => ({ lostResponse: false }),
        }) as never,
        input
      )
    ).rejects.toThrow('ambiguous');
  });
  it('rejects a self-consistent topology mutation for another Worker', async () => {
    const unrelatedEndpoint =
      '/accounts/account/workers/scripts/production-storefront/domains/custom/edge-evidence.ogabassey.com';
    const unrelatedWorker = {
      ...input,
      topologies: asTopologyPlans(
        input.topologies.map((topology) =>
          topology.family === 'worker-custom-domain'
            ? {
                ...topology,
                endpoint: unrelatedEndpoint,
                restore: {
                  ...topology.restore,
                },
              }
            : topology
        )
      ),
      journaledTopologies: asJournaledTopologyPlans(
        input.journaledTopologies.map((topology) =>
          topology.family === 'worker-custom-domain'
            ? { ...topology, endpoint: unrelatedEndpoint }
            : topology
        )
      ),
    };
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client() as never,
        unrelatedWorker
      )
    ).rejects.toThrow('journaled');
  });
});
