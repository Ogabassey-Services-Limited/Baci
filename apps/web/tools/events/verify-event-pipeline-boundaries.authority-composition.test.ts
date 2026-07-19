import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyEventPipelineBoundaries } from './verify-event-pipeline-boundaries';

const roots: string[] = [];
const env = 'apps/web/src/env.ts';
const capability = 'apps/web/src/lib/events/event-ingress-capability.ts';
const scopedJwt = 'apps/web/src/lib/supabase/scoped-jwt.ts';
const signingMaterial = 'apps/web/src/lib/agentic/jwt-signing-material.ts';
const inheritedRoutes = [
  'apps/web/src/app/api/analytics/conversion/route.ts',
  'apps/web/src/app/api/events/route.ts',
] as const;

function git(root: string, ...args: string[]): void {
  execFileSync('git', args, { cwd: root });
}

function write(root: string, path: string, source: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), source);
}

function inheritedRepository(): { baseSha: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'event-authority-composition-'));
  roots.push(root);
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'tests@example.com');
  git(root, 'config', 'user.name', 'Tests');
  write(
    root,
    'apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv',
    `seed\t${capability}\n`
  );
  for (const route of inheritedRoutes)
    write(root, route, `import '@/lib/events/event-ingress-capability';\n`);
  write(
    root,
    capability,
    "import { getSupabaseUrl } from '@/env'; import '@/lib/supabase/scoped-jwt'; void getSupabaseUrl;\n"
  );
  write(root, scopedJwt, "import '@/lib/agentic/jwt-signing-material';\n");
  write(
    root,
    signingMaterial,
    "import { getSupabaseServiceRoleKey } from '@/env'; void getSupabaseServiceRoleKey;\n"
  );
  write(
    root,
    env,
    "export const getSupabaseUrl = () => 'url'; export const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;\n"
  );
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'inherited authority');
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  return { baseSha, root };
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

describe('event pipeline verifier authority composition', () => {
  it('subtracts inherited shared credential paths but rejects a new route path', () => {
    const { baseSha, root } = inheritedRepository();
    const inheritedFindings = verifyEventPipelineBoundaries(
      root,
      baseSha,
      baseSha
    ).join('\n');

    for (const route of inheritedRoutes)
      expect(inheritedFindings).not.toContain(
        `${route} -> ${capability} -> ${scopedJwt} -> ${signingMaterial} -> ${env}`
      );

    const thirdRoute = 'apps/web/src/app/api/third/route.ts';
    const thirdHelper = 'apps/web/src/lib/events/third-credential-helper.ts';
    write(root, thirdRoute, "import '@/lib/events/third-credential-helper';\n");
    write(
      root,
      thirdHelper,
      "import { getSupabaseServiceRoleKey } from '@/env'; void getSupabaseServiceRoleKey;\n"
    );
    const thirdRouteFindings = verifyEventPipelineBoundaries(
      root,
      baseSha,
      baseSha
    ).join('\n');

    expect(thirdRouteFindings).toContain(
      `${thirdRoute} -> ${thirdHelper} -> ${env}`
    );
  });
});
