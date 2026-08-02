import { describe, expect, it } from 'vitest';
import { executeDeepCloudflareEvidenceQualification } from './cloudflare-evidence-provider-qualification';
import {
  client,
  input,
  tuple,
} from './cloudflare-evidence-provider-qualification.test-fixtures';

describe('deep Cloudflare provider control observation', () => {
  it('rejects a final unchanged control readback before the visibility bound', async () => {
    await expect(
      executeDeepCloudflareEvidenceQualification(
        client({
          topologyControlReadback: async (family) => [
            {
              tuple: tuple(family, 'before'),
              pendingOperation: false,
              elapsedSeconds: 30,
            },
          ],
        }),
        input
      )
    ).rejects.toThrow('visibility');
  });
});
