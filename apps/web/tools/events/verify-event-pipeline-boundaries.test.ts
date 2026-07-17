import { existsSync, rmSync, writeFileSync } from 'node:fs';
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
  }, 30_000);

  it('computes a transitive production import closure for moved callers', async () => {
    const moduleUrl = pathToFileURL(verifierPath).href;
    const { collectProductionImportClosure } = await import(
      /* @vite-ignore */ moduleUrl
    );
    expect(typeof collectProductionImportClosure).toBe('function');
    const sources = new Map([
      ['apps/web/src/root.ts', "import './moved-worker';"],
      [
        'apps/web/src/moved-worker.ts',
        "client.rpc('claim_event_deliveries_v1', {})",
      ],
    ]);
    expect(
      collectProductionImportClosure(['apps/web/src/root.ts'], sources)
    ).toEqual(
      new Set(['apps/web/src/root.ts', 'apps/web/src/moved-worker.ts'])
    );
  });

  it('rejects bare clients, untyped factories, assertions, and unmanifested queries', async () => {
    const moduleUrl = pathToFileURL(verifierPath).href;
    const { analyzeRpcSource } = await import(/* @vite-ignore */ moduleUrl);
    const path = 'apps/web/src/app/api/sixth-client/route.ts';
    expect(
      analyzeRpcSource(
        path,
        "import type { SupabaseClient } from '@supabase/supabase-js'; let client: SupabaseClient;",
        true
      )
    ).toContain(`${path}: forbidden bare SupabaseClient`);
    expect(
      analyzeRpcSource(
        path,
        "import { createClient } from '@supabase/supabase-js'; createClient(url, key);",
        true
      )
    ).toContain(`${path}: SDK createClient requires Database`);
    expect(
      analyzeRpcSource(
        path,
        "import * as sdk from '@supabase/supabase-js'; let client: sdk.SupabaseClient; sdk.createClient(url, key);",
        true
      )
    ).toEqual(
      expect.arrayContaining([
        `${path}: forbidden bare SupabaseClient`,
        `${path}: SDK createClient requires Database`,
      ])
    );
    expect(
      analyzeRpcSource(
        path,
        "client.rpc(('claim_event_deliveries_v1' as string), args as object)",
        true
      )
    ).toContain(`${path}: forbidden asserted RPC boundary`);
    expect(analyzeRpcSource(path, '<never>value', true)).toContain(
      `${path}: forbidden never assertion`
    );
    expect(
      analyzeRpcSource(
        path,
        "client.from('unmanifested_table').select('secret')",
        true
      )
    ).toContain(`${path}: unmanifested operation select on unmanifested_table`);
  });

  it('rejects new service/admin route edges and pre-verification privilege', async () => {
    const moduleUrl = pathToFileURL(verifierPath).href;
    const { analyzeRpcSource } = await import(/* @vite-ignore */ moduleUrl);
    const wrapper = 'apps/web/src/app/api/third-wrapper/route.ts';
    expect(
      analyzeRpcSource(
        wrapper,
        "import { createServiceClient } from '@/lib/supabase/service'; const client = createServiceClient('event-pipeline');",
        true
      )
    ).toEqual(
      expect.arrayContaining([
        `${wrapper}: unauthorized trusted wrapper importer`,
        `${wrapper}: privileged client constructed before tenant verification`,
      ])
    );
    const platform = 'apps/web/src/app/api/platform/events/second-forwarder.ts';
    expect(
      analyzeRpcSource(
        platform,
        "import { createAdminClient } from '@/lib/supabase/admin'; createAdminClient();",
        true
      )
    ).toContain(`${platform}: unauthorized admin factory importer`);
  });

  it('governs a new untracked TypeScript path outside naming heuristics', async () => {
    const moduleUrl = pathToFileURL(verifierPath).href;
    const { verifyEventPipelineBoundaries } = await import(
      /* @vite-ignore */ moduleUrl
    );
    const relativeFixture = `src/lib/task5-untracked-worker-${process.pid}.ts`;
    const fixture = resolve(process.cwd(), relativeFixture);
    writeFileSync(
      fixture,
      "import type { SupabaseClient } from '@supabase/supabase-js'; export let leaked: SupabaseClient;",
      { flag: 'wx' }
    );
    try {
      expect(verifyEventPipelineBoundaries()).toContain(
        `apps/web/${relativeFixture}: forbidden bare SupabaseClient`
      );
    } finally {
      rmSync(fixture, { force: true });
    }
  }, 30_000);

  it('rejects an out-of-closure literal RPC caller repo-wide', async () => {
    const moduleUrl = pathToFileURL(verifierPath).href;
    const { analyzeRpcSource } = await import(/* @vite-ignore */ moduleUrl);
    const path = 'apps/web/src/unrelated/out-of-closure.ts';
    expect(
      analyzeRpcSource(path, "client.rpc('route_domain_event_v1', {})", false)
    ).toContain(`${path}: unauthorized direct RPC route_domain_event_v1`);
  });
});
