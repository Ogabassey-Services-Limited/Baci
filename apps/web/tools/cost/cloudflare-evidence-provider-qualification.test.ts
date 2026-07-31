import { describe, expect, it } from 'vitest';
import {
  executeDeepCloudflareEvidenceQualification,
  type TopologyFamily,
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
const input = {
  pointerUrl: 'https://edge-evidence.ogabassey.com/',
  pointerProbeCount: 2,
  trace: {
    cacheRuleId: 'rule',
    rulesetVersion: 'v1',
    expressionSha256: 'a'.repeat(64),
  },
  topologies: families.map((family) => ({
    family,
    action: family === 'r2-cors' ? ('write' as const) : ('detach' as const),
    endpoint: `/accounts/account/${family}`,
    requestSchemaSha256: 'b'.repeat(64),
    maximumVisibilitySeconds: 60,
    before: tuple(family, 'before'),
    intermediate: tuple(family, 'intermediate'),
    after: tuple(family, 'after'),
  })) as never,
};

function client(overrides: Record<string, unknown> = {}) {
  return {
    trace: async () => ({ ...input.trace, matched: true }),
    pointerProbe: async () => ({ cfCacheStatus: 'DYNAMIC' }),
    topologyRead: async (family: TopologyFamily) => tuple(family, 'before'),
    topologyMutate: async (family: TopologyFamily) => ({
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
    await expect(
      executeDeepCloudflareEvidenceQualification(client() as never, input)
    ).resolves.toEqual({ qualified: true });
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
});
