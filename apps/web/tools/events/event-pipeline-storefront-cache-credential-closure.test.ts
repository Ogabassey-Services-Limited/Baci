import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  type CredentialClosureReceipt,
  serviceAuthorityGraphFindings,
} from './event-pipeline-service-authority-graph';

const route =
  'apps/web/src/app/api/internal/storefront-cache-actuator/route.ts';
const barrier = 'apps/web/src/lib/storefront-category-cache-barrier.ts';
const cloudflare = 'apps/web/src/lib/cloudflare-purge.ts';
const env = 'apps/web/src/env.ts';

function sources(extraBarrierImport = '') {
  return new Map([
    [route, "import '@/lib/storefront-category-cache-barrier';"],
    [barrier, `import '@/lib/cloudflare-purge';${extraBarrierImport}`],
    [cloudflare, "import { getCloudflareApiToken } from '@/env';"],
    [
      env,
      'export const getCloudflareApiToken = () => process.env.SUPABASE_SERVICE_ROLE_KEY;',
    ],
  ]);
}

function receipt(
  current: ReadonlyMap<string, string>
): CredentialClosureReceipt {
  return {
    credentialPaths: [
      [route, barrier, cloudflare, env],
      [barrier, cloudflare, env],
    ],
    roots: [route, barrier],
    sourceHashes: Object.fromEntries(
      [route, barrier, cloudflare, env].map((path) => [
        path,
        createHash('sha256')
          .update(current.get(path) ?? '')
          .digest('hex'),
      ])
    ),
  };
}

describe('storefront cache actuator credential closure receipt', () => {
  it('accepts only the exact reviewed route and barrier paths', () => {
    const current = sources();
    expect(
      serviceAuthorityGraphFindings(
        current,
        [route],
        undefined,
        undefined,
        undefined,
        receipt(current)
      )
    ).toEqual([]);
  });

  it('rejects a sibling route, even when it reaches identical source bytes', () => {
    const sibling = 'apps/web/src/app/api/internal/sibling/route.ts';
    const current = sources();
    current.set(sibling, "import '@/lib/storefront-category-cache-barrier';");
    expect(
      serviceAuthorityGraphFindings(
        current,
        [sibling],
        undefined,
        undefined,
        undefined,
        receipt(current)
      ).join('\n')
    ).toContain(`${sibling} -> ${barrier} -> ${cloudflare} -> ${env}`);
  });

  it('rejects an extra credential branch from the declared barrier', () => {
    const helper = 'apps/web/src/lib/extra-credential-branch.ts';
    const current = sources("import '@/lib/extra-credential-branch';");
    current.set(helper, "import { getCloudflareApiToken } from '@/env';");
    expect(
      serviceAuthorityGraphFindings(
        current,
        [route],
        undefined,
        undefined,
        undefined,
        receipt(current)
      ).join('\n')
    ).toContain(`${barrier} -> ${helper} -> ${env}`);
  });

  it('rejects a one-byte source-hash drift on an otherwise exact path', () => {
    const current = sources();
    const approved = receipt(current);
    current.set(barrier, `${current.get(barrier)}\n`);
    expect(
      serviceAuthorityGraphFindings(
        current,
        [route],
        undefined,
        undefined,
        undefined,
        approved
      ).join('\n')
    ).toContain(`${route} -> ${barrier} -> ${cloudflare} -> ${env}`);
  });

  it.each([
    'missing',
    'extra',
  ] as const)('rejects a %s receipt hash entry', (kind) => {
    const current = sources();
    const approved = receipt(current);
    if (kind === 'missing') delete approved.sourceHashes[env];
    else
      approved.sourceHashes['apps/web/src/lib/unreviewed.ts'] = '0'.repeat(64);

    expect(
      serviceAuthorityGraphFindings(
        current,
        [route],
        undefined,
        undefined,
        undefined,
        approved
      ).join('\n')
    ).toContain(`${route} -> ${barrier} -> ${cloudflare} -> ${env}`);
  });
});
