import { describe, expect, it } from 'vitest';
import { serviceRoleCredentialFinding } from './event-pipeline-service-authority-graph';
import { analyzeRpcSource } from './verify-event-pipeline-boundaries';

describe('event pipeline RPC service authority', () => {
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

  it('rejects an SDK service-role construction in a fourth route', () => {
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
  ])('rejects alternate SDK factory edges: %s', (source, message) => {
    const path = 'apps/web/src/app/api/fourth/route.ts';
    expect(analyzeRpcSource(path, source, true)).toContain(
      `${path}: ${message}`
    );
  });

  it('rejects a deep SDK factory import in a governed route', () => {
    const path = 'apps/web/src/app/api/fourth/route.ts';
    const source =
      "import { createClient } from '@supabase/supabase-js/dist/index.mjs'; createClient(url, importedKey);";

    expect(analyzeRpcSource(path, source, true)).toContain(
      `${path}: unauthorized privileged SDK factory importer`
    );
  });

  it('rejects a runtime SDK factory in the pure compatibility facade', () => {
    const path = 'apps/web/src/lib/analytics/send-to-ad-platforms.ts';
    const source =
      "import { createClient } from '@supabase/supabase-js'; createClient<Database>(url, key);";
    expect(analyzeRpcSource(path, source, true)).toContain(
      `${path}: unauthorized privileged SDK factory importer`
    );
  });
});
