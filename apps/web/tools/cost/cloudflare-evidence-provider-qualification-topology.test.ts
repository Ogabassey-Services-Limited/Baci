import { describe, expect, it } from 'vitest';
import type {
  DeepQualificationClient,
  TopologyFamily,
  TopologyMutationRequest,
  TopologyPlan,
} from './cloudflare-evidence-provider-qualification';
import {
  client,
  input,
} from './cloudflare-evidence-provider-qualification.test-fixtures';
import { executeTopologyMutationWithRollback } from './cloudflare-evidence-provider-qualification-topology';

const families = [
  'worker-custom-domain',
  'r2-cors',
  'r2-custom-domain',
] as const satisfies readonly TopologyFamily[];

function topologyFor(family: TopologyFamily): TopologyPlan {
  const topology = input.topologies.find(
    (candidate) => candidate.family === family
  );
  if (!topology) throw new Error(`missing topology fixture for ${family}`);
  return topology;
}

function assertForwardAndRestoreRequests(
  requests: readonly TopologyMutationRequest[],
  topology: TopologyPlan
) {
  expect(requests).toHaveLength(2);
  expect(requests.map(({ action }) => action)).toEqual([
    topology.action,
    topology.restore.action,
  ]);
  expect(requests.every(({ endpoint }) => endpoint === topology.endpoint)).toBe(
    true
  );
}

describe('Cloudflare topology mutation rollback', () => {
  it.each(
    families
  )('restores %s after forward response validation fails', async (family) => {
    const topology = topologyFor(family);
    const requests: TopologyMutationRequest[] = [];
    let forward = true;
    const base = client();
    const injected: DeepQualificationClient = {
      ...base,
      topologyMutate: async (request) => {
        requests.push(request);
        if (forward) {
          forward = false;
          return { lostResponse: false };
        }
        return base.topologyMutate(request);
      },
    };

    await expect(
      executeTopologyMutationWithRollback(injected, topology)
    ).rejects.toThrow('ambiguous');
    assertForwardAndRestoreRequests(requests, topology);
  });

  it.each(
    families
  )('restores %s after an ambiguous forward provider failure', async (family) => {
    const topology = topologyFor(family);
    const requests: TopologyMutationRequest[] = [];
    let forward = true;
    const base = client();
    const injected: DeepQualificationClient = {
      ...base,
      topologyMutate: async (request) => {
        requests.push(request);
        if (forward) {
          forward = false;
          throw new Error('forward mutation response was lost');
        }
        return base.topologyMutate(request);
      },
    };

    await expect(
      executeTopologyMutationWithRollback(injected, topology)
    ).rejects.toThrow('forward mutation response was lost');
    assertForwardAndRestoreRequests(requests, topology);
  });

  it.each(
    families
  )('restores %s after convergence polling fails', async (family) => {
    const topology = topologyFor(family);
    const requests: TopologyMutationRequest[] = [];
    const base = client();
    const injected: DeepQualificationClient = {
      ...base,
      topologyMutate: async (request) => {
        requests.push(request);
        return base.topologyMutate(request);
      },
      topologyPoll: async (candidate, maximumVisibilitySeconds) => {
        if (candidate === family) throw new Error('poll failed');
        return base.topologyPoll(candidate, maximumVisibilitySeconds);
      },
    };

    await expect(
      executeTopologyMutationWithRollback(injected, topology)
    ).rejects.toThrow('poll failed');
    assertForwardAndRestoreRequests(requests, topology);
  });

  it.each(
    families
  )('rejects %s convergence with monotonic negative elapsed seconds', async (family) => {
    const topology = topologyFor(family);
    const requests: TopologyMutationRequest[] = [];
    const base = client();
    const injected: DeepQualificationClient = {
      ...base,
      topologyMutate: async (request) => {
        requests.push(request);
        return base.topologyMutate(request);
      },
      topologyPoll: async (candidate) => {
        if (candidate === family)
          return [
            {
              tuple: topology.intermediate,
              pendingOperation: true,
              elapsedSeconds: -0.75,
            },
            {
              tuple: topology.after,
              pendingOperation: false,
              elapsedSeconds: -0.5,
            },
          ];
        return base.topologyPoll(candidate, topology.maximumVisibilitySeconds);
      },
    };

    await expect(
      executeTopologyMutationWithRollback(injected, topology)
    ).rejects.toThrow('visibility');
    assertForwardAndRestoreRequests(requests, topology);
  });

  it.each(
    families
  )('restores %s after restoration readback fails', async (family) => {
    const topology = topologyFor(family);
    const requests: TopologyMutationRequest[] = [];
    const base = client();
    const injected: DeepQualificationClient = {
      ...base,
      topologyMutate: async (request) => {
        requests.push(request);
        return base.topologyMutate(request);
      },
      topologyControlReadback: async (candidate, maximumVisibilitySeconds) => {
        if (candidate === family) throw new Error('readback failed');
        return base.topologyControlReadback(
          candidate,
          maximumVisibilitySeconds
        );
      },
    };

    await expect(
      executeTopologyMutationWithRollback(injected, topology)
    ).rejects.toThrow('readback failed');
    assertForwardAndRestoreRequests(requests, topology);
  });

  it.each(
    families
  )('rejects %s when the forward response schema fingerprint is wrong', async (family) => {
    const topology = topologyFor(family);
    const requests: TopologyMutationRequest[] = [];
    const base = client();
    let forward = true;
    const injected: DeepQualificationClient = {
      ...base,
      topologyMutate: async (request) => {
        requests.push(request);
        const response = await base.topologyMutate(request);
        if (!forward) return response;
        forward = false;
        return { ...response, responseSchemaSha256: 'f'.repeat(64) };
      },
    };

    await expect(
      executeTopologyMutationWithRollback(injected, topology)
    ).rejects.toThrow('response schema');
    assertForwardAndRestoreRequests(requests, topology);
  });

  it.each(
    families
  )('rejects %s when the restore response schema fingerprint is wrong', async (family) => {
    const topology = topologyFor(family);
    const requests: TopologyMutationRequest[] = [];
    const base = client();
    let mutationCount = 0;
    const injected: DeepQualificationClient = {
      ...base,
      topologyMutate: async (request) => {
        requests.push(request);
        const response = await base.topologyMutate(request);
        mutationCount += 1;
        return mutationCount === 2
          ? { ...response, responseSchemaSha256: 'f'.repeat(64) }
          : response;
      },
    };

    await expect(
      executeTopologyMutationWithRollback(injected, topology)
    ).rejects.toThrow('response schema');
    assertForwardAndRestoreRequests(requests, topology);
  });
});
