import { describe, expect, it } from 'vitest';
import {
  executeDeepCloudflareEvidenceQualification,
  type JournaledTopologyEndpoint,
  type TopologyFamily,
  type TopologyPlan,
} from './cloudflare-evidence-provider-qualification';
import {
  client,
  input,
  tuple,
} from './cloudflare-evidence-provider-qualification.test-fixtures';

describe('deep Cloudflare provider topology qualification', () => {
  it('polls normal and lost-response mutations to exact after tuples for every family', async () => {
    const result = await executeDeepCloudflareEvidenceQualification(
      client(),
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
      executeDeepCloudflareEvidenceQualification(client(), input)
    ).resolves.toMatchObject({ qualified: true });
  });
  it('uses the inverse reattach action when restoring detached topology', async () => {
    const requests: Array<{ family: TopologyFamily; action: string }> = [];
    const base = client();
    await executeDeepCloudflareEvidenceQualification(
      client({
        topologyMutate: async (request) => {
          requests.push({ family: request.family, action: request.action });
          return base.topologyMutate(request);
        },
      }),
      input
    );
    expect(requests).toEqual([
      { family: 'worker-custom-domain', action: 'detach' },
      { family: 'worker-custom-domain', action: 'reattach' },
      { family: 'r2-cors', action: 'write' },
      { family: 'r2-cors', action: 'write' },
      { family: 'r2-custom-domain', action: 'detach' },
      { family: 'r2-custom-domain', action: 'reattach' },
    ]);
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
        }),
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
        }),
        input
      )
    ).rejects.toThrow('visibility');
  });
  it('rejects convergence readings whose elapsed time decreases', async () => {
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyPoll: async (family: TopologyFamily) => [
            {
              tuple: tuple(family, 'intermediate'),
              pendingOperation: true,
              elapsedSeconds: 2,
            },
            {
              tuple: tuple(family, 'after'),
              pendingOperation: false,
              elapsedSeconds: 1,
            },
          ],
        }),
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
        }),
        input
      )
    ).rejects.toThrow('tuple');
  });
  it('rejects a topology plan whose before and after tuples are identical', async () => {
    const unchangedTopologies: readonly [
      TopologyPlan,
      TopologyPlan,
      TopologyPlan,
    ] = [
      input.topologies[0],
      { ...input.topologies[1], after: input.topologies[1].before },
      input.topologies[2],
    ];
    const unchangedJournaledTopologies: readonly [
      JournaledTopologyEndpoint,
      JournaledTopologyEndpoint,
      JournaledTopologyEndpoint,
    ] = [
      input.journaledTopologies[0],
      {
        ...input.journaledTopologies[1],
        after: input.journaledTopologies[1].before,
      },
      input.journaledTopologies[2],
    ];
    const unchanged = {
      ...input,
      topologies: unchangedTopologies,
      journaledTopologies: unchangedJournaledTopologies,
    };
    await expect(
      executeDeepCloudflareEvidenceQualification(client(), unchanged)
    ).rejects.toThrow('real mutation');
  });
  it('rejects BYPASS as pointer-cache proof and never forwards an unjournaled URL', async () => {
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          pointerProbe: async () => ({
            status: 204,
            cfCacheStatus: 'BYPASS',
            headers: {
              'X-Baci-Evidence-Bundle': 'version-a-204',
              'X-Baci-Evidence-Version': 'a',
            },
          }),
        }),
        input
      )
    ).rejects.toThrow('cacheable');
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          pointerProbe: async () => ({
            status: 404,
            cfCacheStatus: 'DYNAMIC',
            headers: {},
          }),
        }),
        input
      )
    ).rejects.toThrow('reviewed qualification fixture');
    await expect(
      executeDeepCloudflareEvidenceQualification(client(), {
        ...input,
        pointerProbeExpectation: {
          bundle: 'version-a-204',
          version: 'unreviewed',
        },
      })
    ).rejects.toThrow('reviewed fixture');
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          pointerProbe: async () => ({
            status: 204,
            cfCacheStatus: 'DYNAMIC',
            headers: {
              'X-Baci-Evidence-Bundle': 'unreviewed',
              'X-Baci-Evidence-Version': 'a',
            },
          }),
        }),
        input
      )
    ).rejects.toThrow('reviewed qualification fixture');
    await expect(
      executeDeepCloudflareEvidenceQualification(client(), {
        ...input,
        pointerUrl: 'https://edge-evidence.ogabassey.com/unreviewed',
      })
    ).rejects.toThrow('pointer URL');
    await expect(
      executeDeepCloudflareEvidenceQualification(client(), {
        ...input,
        topologies: [
          input.topologies[0],
          {
            ...input.topologies[1],
            endpoint: '/accounts/other/r2/buckets/other/cors',
          },
          input.topologies[2],
        ],
      })
    ).rejects.toThrow('journaled');
    await expect(
      executeDeepCloudflareEvidenceQualification(client(), {
        ...input,
        journaledTopologies: [
          input.journaledTopologies[0],
          {
            ...input.journaledTopologies[1],
            responseSchemaSha256: 'd'.repeat(64),
          },
          input.journaledTopologies[2],
        ],
      })
    ).rejects.toThrow('journaled');
  });
  it('rejects an ambiguous topology mutation response instead of claiming an audited receipt', async () => {
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyMutate: async () => ({}),
        }),
        input
      )
    ).rejects.toThrow('ambiguous');
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyMutate: async () => ({ lostResponse: false }),
        }),
        input
      )
    ).rejects.toThrow('ambiguous');
  });
  it('rejects a self-consistent topology mutation for another Worker', async () => {
    const unrelatedEndpoint =
      '/accounts/account/workers/scripts/production-storefront/domains/custom/edge-evidence.ogabassey.com';
    const unrelatedTopologies: readonly [
      TopologyPlan,
      TopologyPlan,
      TopologyPlan,
    ] = [
      {
        ...input.topologies[0],
        endpoint: unrelatedEndpoint,
      },
      input.topologies[1],
      input.topologies[2],
    ];
    const unrelatedJournaledTopologies: readonly [
      JournaledTopologyEndpoint,
      JournaledTopologyEndpoint,
      JournaledTopologyEndpoint,
    ] = [
      { ...input.journaledTopologies[0], endpoint: unrelatedEndpoint },
      input.journaledTopologies[1],
      input.journaledTopologies[2],
    ];
    const unrelatedWorker = {
      ...input,
      topologies: unrelatedTopologies,
      journaledTopologies: unrelatedJournaledTopologies,
    };
    await expect(
      executeDeepCloudflareEvidenceQualification(client(), unrelatedWorker)
    ).rejects.toThrow('journaled');
  });
});
