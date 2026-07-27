import { describe, expect, it } from 'vitest';
import { serviceAuthorityGraphFindings } from './event-pipeline-service-authority-graph';

const cloudflarePurge = 'apps/web/src/lib/cloudflare-purge.ts';
const credentialAuthority = 'apps/web/src/env.ts';
const hostnameScheduler =
  'apps/web/src/lib/storefront-product-purge-hostnames.ts';

function sourcesFor(root: string): Map<string, string> {
  return new Map([
    [
      root,
      "import { purgeCloudflareHostnamesConfirmed } from '@/lib/cloudflare-purge';",
    ],
    [
      cloudflarePurge,
      "import { getSupabaseServiceRoleKey } from '@/env'; void getSupabaseServiceRoleKey;",
    ],
    [
      credentialAuthority,
      'export const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;',
    ],
  ]);
}

describe('storefront product hostname purge credential authority', () => {
  it('allows only the exact scheduler-to-Cloudflare credential path', () => {
    expect(
      serviceAuthorityGraphFindings(
        sourcesFor(hostnameScheduler),
        [hostnameScheduler],
        new Map()
      )
    ).toEqual([]);

    const rogueScheduler = 'apps/web/src/lib/rogue-hostname-purge.ts';
    expect(
      serviceAuthorityGraphFindings(
        sourcesFor(rogueScheduler),
        [rogueScheduler],
        new Map()
      )
    ).toEqual([
      `${rogueScheduler}: production surface import graph reaches credential authority ${credentialAuthority} via ${rogueScheduler} -> ${cloudflarePurge} -> ${credentialAuthority}`,
    ]);
  });
});
