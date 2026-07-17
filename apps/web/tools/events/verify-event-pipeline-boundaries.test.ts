import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const verifierPath = resolve(
  process.cwd(),
  'tools/events/verify-event-pipeline-boundaries.ts'
);

describe('event pipeline source boundary verifier', () => {
  it('discovers the immutable inventory plus dynamic changed and untracked paths', async () => {
    expect(
      existsSync(verifierPath),
      'source boundary verifier is missing'
    ).toBe(true);
    if (!existsSync(verifierPath)) return;
    const moduleUrl = pathToFileURL(verifierPath).href;
    const { collectGovernedPaths } = await import(/* @vite-ignore */ moduleUrl);
    const paths = collectGovernedPaths();
    expect(paths.fixtureRecordCount).toBe(154);
    expect(paths.paths).toContain(
      'apps/web/src/scripts/process-event-deliveries.ts'
    );
    expect(paths.paths).toContain(
      'apps/web/tools/events/verify-event-pipeline-boundaries.ts'
    );
  });

  it('rejects every frozen escape and unauthorized direct caller', async () => {
    expect(
      existsSync(verifierPath),
      'source boundary verifier is missing'
    ).toBe(true);
    if (!existsSync(verifierPath)) return;
    const moduleUrl = pathToFileURL(verifierPath).href;
    const {
      analyzeRpcSource,
      frozenRouteHashFinding,
      verifyEventPipelineBoundaries,
    } = await import(/* @vite-ignore */ moduleUrl);
    expect(verifyEventPipelineBoundaries()).toEqual([]);
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "client.rpc('claim_event_deliveries_v1', {})",
        true
      )
    ).toContain(
      'apps/web/src/lib/events/new-worker.ts: unauthorized direct RPC claim_event_deliveries_v1'
    );
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "client.rpc('replay_event_delivery_v1', {})",
        true
      )
    ).toContain(
      'apps/web/src/lib/events/new-worker.ts: forbidden direct RPC replay_event_delivery_v1'
    );
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "const name = 'claim_event_deliveries_v1'; client.rpc(name, {}); const escape = value as never;",
        true
      )
    ).toEqual(
      expect.arrayContaining([
        'apps/web/src/lib/events/new-worker.ts: forbidden never assertion',
        'apps/web/src/lib/events/new-worker.ts: unauthorized direct RPC claim_event_deliveries_v1',
      ])
    );
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "client.rpc('unclassified_pipeline_rpc_v1', {})",
        true
      )
    ).toContain(
      'apps/web/src/lib/events/new-worker.ts: unclassified RPC unclassified_pipeline_rpc_v1'
    );
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        'client.rpc(dynamicName(), {})',
        true
      )
    ).toContain(
      'apps/web/src/lib/events/new-worker.ts: unresolved indirect RPC name'
    );
    expect(
      analyzeRpcSource(
        'vps-workers/jobs/supabase-retention-cleanup.mjs',
        'const rpcName = `cleanup_domain_event_pipeline_v1`; client.rpc(rpcName, {})',
        true
      )
    ).toEqual([]);
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "client['rpc']('replay_event_delivery_v1', {})",
        true
      )
    ).toContain(
      'apps/web/src/lib/events/new-worker.ts: forbidden direct RPC replay_event_delivery_v1'
    );
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "const invoke = client.rpc.bind(client); invoke('claim_event_deliveries_v1', {})",
        true
      )
    ).toContain(
      'apps/web/src/lib/events/new-worker.ts: unauthorized direct RPC claim_event_deliveries_v1'
    );
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "const invoke = client.rpc; { const invoke = () => undefined; invoke('claim_event_deliveries_v1', {}); }",
        true
      )
    ).toEqual([]);
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "client.from('merchants').select('id,bvn')",
        true
      )
    ).toContain(
      'apps/web/src/lib/events/new-worker.ts: unauthorized merchants column bvn'
    );
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "const query = client.from('merchants'); const select = query.select; select('id,bvn')",
        true
      )
    ).toContain(
      'apps/web/src/lib/events/new-worker.ts: unauthorized merchants column bvn'
    );
    expect(
      analyzeRpcSource(
        'apps/web/src/lib/events/new-worker.ts',
        "const query = client.from('merchants'); const select = query.select.bind(query); select('id,bvn')",
        true
      )
    ).toContain(
      'apps/web/src/lib/events/new-worker.ts: unauthorized merchants column bvn'
    );
    expect(frozenRouteHashFinding('route.ts', 'drift', 'expected')).toMatch(
      /^route\.ts: frozen route hash /
    );
  });
});
