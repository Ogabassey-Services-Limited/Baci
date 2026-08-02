import { describe, expect, it } from 'vitest';
import { executeDeepCloudflareEvidenceQualification } from './cloudflare-evidence-provider-qualification';
import {
  client,
  input,
} from './cloudflare-evidence-provider-qualification.test-fixtures';

describe('deep Cloudflare provider topology qualification boundaries', () => {
  it('rejects a self-consistent topology mutation for another Worker', async () => {
    const unrelatedEndpoint =
      '/accounts/account/workers/scripts/production-storefront/domains/custom/edge-evidence.ogabassey.com';
    const unrelatedTopologies = [
      { ...input.topologies[0], endpoint: unrelatedEndpoint },
      input.topologies[1],
      input.topologies[2],
    ] as const;
    await expect(
      executeDeepCloudflareEvidenceQualification(client(), {
        ...input,
        topologies: unrelatedTopologies,
      })
    ).rejects.toThrow('journaled');
  });

  it('rejects a topology resource whose provider inventory is not the journal snapshot', async () => {
    const calls: string[] = [];
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyResourceReadback: async () => ({
            accountId: 'account',
            bucketName:
              'baci-ogabassey-storefront-evidence-0123456789abcdef0123456789abcdef',
            inventorySha256: 'f'.repeat(64),
            present: true,
          }),
          topologyMutate: async () => {
            calls.push('mutate');
            return {};
          },
        }),
        input
      )
    ).rejects.toThrow('run-journaled inventory');
    expect(calls).toEqual([]);
  });
});
