import { describe, expect, it } from 'vitest';
import {
  serviceAuthorityGraphFindings,
  serviceRoleCredentialFinding,
} from './event-pipeline-service-authority-graph';

describe('event pipeline service authority graph', () => {
  it('rejects fourth-route indirect test-client authority', () => {
    const sources = new Map([
      [
        'apps/web/src/app/api/fourth/route.ts',
        "import '@/lib/events/service-facade';",
      ],
      [
        'apps/web/src/lib/events/service-facade.ts',
        "export * from '@/lib/events/event-pipeline-service-role-test-client';",
      ],
      [
        'apps/web/src/lib/events/event-pipeline-service-role-test-client.ts',
        'export const client = {};',
      ],
    ]);
    expect(serviceAuthorityGraphFindings(sources)).toEqual([
      'apps/web/src/app/api/fourth/route.ts: API import graph reaches service authority apps/web/src/lib/events/event-pipeline-service-role-test-client.ts',
    ]);
  });

  it('rejects extra worker and test-client edges from approved routes', () => {
    const sources = new Map([
      [
        'apps/web/src/app/api/analytics/conversion/route.ts',
        "import '@/lib/events/event-pipeline-service-role-test-client';",
      ],
      [
        'apps/web/src/app/api/events/route.ts',
        "import '@/scripts/process-event-deliveries';",
      ],
      [
        'apps/web/src/lib/events/event-pipeline-service-role-test-client.ts',
        'export {};',
      ],
      ['apps/web/src/scripts/process-event-deliveries.ts', 'export {};'],
    ]);
    expect(serviceAuthorityGraphFindings(sources)).toHaveLength(2);
  });

  it('rejects service-role env reachability outside the allowlist', () => {
    const path = 'apps/web/src/app/api/fourth/route.ts';
    expect(
      serviceRoleCredentialFinding(
        path,
        'const { env } = process; use(env.SUPABASE_SERVICE_ROLE_KEY);'
      )
    ).toBe(`${path}: service-role credential read is forbidden`);
    expect(
      serviceRoleCredentialFinding(
        path,
        "Reflect.get(globalThis.process.env, 'SUPABASE_SERVICE_ROLE_KEY')"
      )
    ).toBe(`${path}: service-role credential read is forbidden`);
  });

  it('rejects an SDK service-role construction in a fourth route', async () => {
    const { analyzeRpcSource } = await import(
      './verify-event-pipeline-boundaries'
    );
    const path = 'apps/web/src/app/api/fourth/route.ts';
    const source =
      "import { createClient } from '@supabase/supabase-js'; const { env } = process; createClient<Database>(url, env.SUPABASE_SERVICE_ROLE_KEY).auth.admin.listUsers();";
    expect(analyzeRpcSource(path, source, true)).toEqual(
      expect.arrayContaining([
        `${path}: unauthorized privileged SDK factory importer`,
        `${path}: service-role credential read is forbidden`,
      ])
    );
  });

  it.each([
    [
      "import * as sdk from '@supabase/supabase-js'; sdk.createClient(url, key);",
      'unauthorized privileged SDK factory importer',
    ],
    [
      "void import('@supabase/supabase-js');",
      'unauthorized dynamic privileged factory import',
    ],
  ])('rejects alternate SDK factory edges: %s', async (source, message) => {
    const { analyzeRpcSource } = await import(
      './verify-event-pipeline-boundaries'
    );
    const path = 'apps/web/src/app/api/fourth/route.ts';
    expect(analyzeRpcSource(path, source, true)).toContain(
      `${path}: ${message}`
    );
  });

  it('rejects a runtime SDK factory in the pure compatibility facade', async () => {
    const { analyzeRpcSource } = await import(
      './verify-event-pipeline-boundaries'
    );
    const path = 'apps/web/src/lib/analytics/send-to-ad-platforms.ts';
    const source =
      "import { createClient } from '@supabase/supabase-js'; createClient<Database>(url, key);";
    expect(analyzeRpcSource(path, source, true)).toContain(
      `${path}: unauthorized privileged SDK factory importer`
    );
  });
});
