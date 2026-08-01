import { describe, expect, it } from 'vitest';
import { currentWithWorkersLogsContract } from './ogabassey-current-origin-baseline.test-fixtures';
import { isRetrievedCloudflareWorkersLogsContract } from './ogabassey-current-origin-baseline-workers-logs';

describe('Ogabassey Workers Logs capability', () => {
  it('brands only contracts retrieved with the authenticated provider receipt', async () => {
    const capability = await currentWithWorkersLogsContract();

    expect(isRetrievedCloudflareWorkersLogsContract(capability)).toBe(true);
    expect(isRetrievedCloudflareWorkersLogsContract({ ...capability })).toBe(
      false
    );
    expect(capability.provenance).toMatchObject({
      kind: 'authenticated_provider_retrieval',
    });
  });
});
