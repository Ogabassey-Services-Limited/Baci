import { describe, expect, it } from 'vitest';
import { analyzeRpcSource } from './verify-event-pipeline-boundaries';

describe('event pipeline JSX source boundary', () => {
  it('detects an unauthorized RPC embedded in JSX', () => {
    const path = 'apps/web/src/lib/events/rogue-view.jsx';

    expect(
      analyzeRpcSource(
        path,
        "export const View = () => <Replay result={client.rpc('replay_event_delivery_v1', {})} />;",
        true
      )
    ).toContain(`${path}: forbidden direct RPC replay_event_delivery_v1`);
  });
});
