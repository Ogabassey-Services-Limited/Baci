import { describe, expect, it } from 'vitest';
import { analyzeRpcSource } from './verify-event-pipeline-boundaries';

describe('changed event-pipeline boundaries', () => {
  it('does not apply event-pipeline table policy to unrelated changed queries', () => {
    const path = 'apps/web/src/app/api/payments/provider/route.ts';

    expect(
      analyzeRpcSource(
        path,
        "client.from('transactions').select('id')",
        false,
        false
      )
    ).toEqual([]);
  });

  it('still rejects direct event-pipeline RPC calls from changed sources', () => {
    const path = 'apps/web/src/app/api/payments/provider/route.ts';

    expect(
      analyzeRpcSource(
        path,
        "client.rpc('route_domain_event_v1', {})",
        false,
        false
      )
    ).toContain(`${path}: unauthorized direct RPC route_domain_event_v1`);
  });
});
