import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { eventPipelineModularityVerifier } from './verify-event-pipeline-modularity';

const directories: string[] = [];
// biome-ignore format: exact grandfathered paths stay compact under the verifier gate.
const grandfatheredAggregatePaths = ['apps/web/src/lib/events/event-pipeline-boundary-manifest.ts', 'apps/web/src/lib/events/event-pipeline-database.ts', 'apps/web/tools/events/event-pipeline-service-authority-graph.ts', 'apps/web/tools/events/verify-analytics-delivery-authority.ts', 'apps/web/tools/events/verify-event-pipeline-boundaries.ts'];

function write(root: string, path: string, source: string): void {
  mkdirSync(join(root, dirname(path)), { recursive: true });
  writeFileSync(join(root, path), source);
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

// biome-ignore format: compact verifier helper keeps this test under its own gate.
const verify = (root: string, baseSha: string, includeWorkingTree = true) => eventPipelineModularityVerifier.verify(root, { baseSha, includeWorkingTree });

function fixtureRepository(): { baseSha: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'event-modularity-'));
  directories.push(root);
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'tests@example.com']);
  git(root, ['config', 'user.name', 'Tests']);
  write(
    root,
    'apps/web/src/lib/events/tracked-worker.ts',
    'export const trackedWorker = true;\n'
  );
  write(root, 'apps/web/src/lib/events/tracked-worker.test.ts', 'export {};\n');
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'frozen base']);
  const baseSha = git(root, ['rev-parse', 'HEAD']);
  write(
    root,
    'apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv',
    'A\tapps/web/src/lib/events/tracked-worker.ts\n'
  );
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'frozen inventory']);
  return { baseSha, root };
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { force: true, recursive: true });
});

describe('event pipeline modularity verifier', () => {
  it('unions frozen-base commits with staged, unstaged, and untracked paths', () => {
    const { baseSha, root } = fixtureRepository();
    const committed = 'apps/web/src/lib/events/committed-worker.ts';
    const staged = 'apps/web/src/lib/events/staged-worker.ts';
    const untracked = 'apps/web/src/lib/events/untracked-worker.ts';
    write(root, committed, 'export const committedWorker = true;\n');
    write(root, committed.replace('.ts', '.test.ts'), 'export {};\n');
    git(root, ['add', '.']);
    git(root, ['commit', '--quiet', '-m', 'committed worker']);
    git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    write(
      root,
      'apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv',
      'A\tapps/web/src/lib/events/current-inventory-only.ts\n'
    );
    write(
      root,
      'apps/web/src/lib/events/tracked-worker.ts',
      'export const trackedWorker = false;\n'
    );
    write(root, staged, 'export const stagedWorker = true;\n');
    write(root, staged.replace('.ts', '.test.ts'), 'export {};\n');
    git(root, ['add', staged, staged.replace('.ts', '.test.ts')]);
    write(root, untracked, 'export const untrackedWorker = true;\n');
    write(root, untracked.replace('.ts', '.test.ts'), 'export {};\n');
    const collected = eventPipelineModularityVerifier.collect(root, {
      baseSha,
      includeWorkingTree: true,
    });
    expect(collected.paths).toEqual(
      expect.arrayContaining([
        committed,
        staged,
        untracked,
        'apps/web/src/lib/events/tracked-worker.ts',
      ])
    );
    expect(collected.newModulePaths).toEqual(
      expect.arrayContaining([
        committed,
        staged,
        untracked,
        'apps/web/src/lib/events/tracked-worker.ts',
      ])
    );
    expect(collected.newModulePaths).not.toContain(
      'apps/web/src/lib/events/current-inventory-only.ts'
    );
  });

  it('checks staged index bytes and filesystem overlays independently', () => {
    const { baseSha, root } = fixtureRepository();
    const path = 'apps/web/src/lib/events/staged-overlay.ts';
    const testPath = path.replace('.ts', '.test.ts');
    const good = 'export const first = true;\n';
    const bad =
      'const first = true;\nconst second = true;\nexport { first, second };\n';
    write(root, path, bad);
    write(root, testPath, 'export {};\n');
    git(root, ['add', path, testPath]);
    write(root, path, good);
    expect(verify(root, baseSha)).toContain(
      `${path}: multiple runtime exports first, second`
    );
    git(root, ['add', path]);
    write(root, path, bad);
    expect(verify(root, baseSha)).toContain(
      `${path}: multiple runtime exports first, second`
    );

    const committed = 'apps/web/src/lib/events/committed-untested.ts';
    write(root, committed, 'export const committedUntested = true;\n');
    git(root, ['add', committed]);
    git(root, ['commit', '--quiet', '-m', 'untested runtime']);
    write(root, committed.replace('.ts', '.test.ts'), 'export {};\n');
    expect(verify(root, baseSha, false)).toContain(
      `${committed}: runtime source is missing colocated test ${committed.replace('.ts', '.test.ts')}`
    );
  });

  it('governs changed helpers reached outside allowlisted prefixes', () => {
    const { baseSha, root } = fixtureRepository();
    const entry = 'apps/web/src/scripts/process-domain-events.ts';
    const helper = 'apps/web/src/shared/reachable-event-helper.ts';
    write(root, entry, "import '../shared/reachable-event-helper';\n");
    write(root, entry.replace('.ts', '.test.ts'), 'export {};\n');
    write(
      root,
      helper,
      `${'// boundary\n'.repeat(299)}export const first = true;\nexport const second = true;\n`
    );
    const collected = eventPipelineModularityVerifier.collect(root, {
      baseSha,
      includeWorkingTree: true,
    });
    const findings = verify(root, baseSha);

    expect(collected.paths).toContain(helper);
    expect(collected.newModulePaths).toContain(helper);
    expect(findings).toContain(`${helper}: exceeds 300 lines (301)`);
    expect(findings).toContain(
      `${helper}: runtime source is missing colocated test ${helper.replace('.ts', '.test.ts')}`
    );
    expect(findings).toContain(
      `${helper}: multiple runtime exports first, second`
    );
  });

  it('reports synthetic untracked oversized and untested runtime modules', () => {
    const { baseSha, root } = fixtureRepository();
    const oversized = 'apps/web/src/lib/events/oversized-worker.ts';
    const untested = 'apps/web/src/lib/events/untested-worker.ts';
    // biome-ignore format: runtime import fixtures stay compact under the verifier gate.
    const imported = [['side-effect-import.ts', "import './runtime';\n"], ['empty-import.ts', "import {} from './runtime';\n"], ['value-import.ts', "import { run } from './runtime';\n"]] as const;
    write(
      root,
      oversized,
      `${'// boundary\n'.repeat(300)}export const run = true;\n`
    );
    write(root, untested, 'export function run(): void {}\n');
    for (const [name, source] of imported)
      write(root, `apps/web/src/lib/events/${name}`, source);

    const findings = verify(root, baseSha);

    expect(findings).toContain(`${oversized}: exceeds 300 lines (301)`);
    expect(findings).toContain(
      `${oversized}: runtime source is missing colocated test apps/web/src/lib/events/oversized-worker.test.ts`
    );
    expect(findings).toContain(
      `${untested}: runtime source is missing colocated test apps/web/src/lib/events/untested-worker.test.ts`
    );
    for (const [name] of imported)
      expect(findings).toContain(
        `apps/web/src/lib/events/${name}: runtime source is missing colocated test apps/web/src/lib/events/${name.replace('.ts', '.test.ts')}`
      );
  });

  it('permits route methods, type-only files, and thin re-export facades', () => {
    const { baseSha, root } = fixtureRepository();
    // biome-ignore format: permitted module fixtures stay compact under the verifier gate.
    for (const [path, source] of [['apps/web/src/app/api/events/synthetic/route.ts', 'export function GET() {}\nexport function POST() {}\n'], ['apps/web/src/app/api/events/synthetic/route.test.ts', 'export {};\n'], ['apps/web/src/lib/events/synthetic-types.ts', 'export type Synthetic = { id: string };\n'], ['apps/web/src/lib/events/type-only-import.ts', "import { type Synthetic } from './synthetic-types';\nexport type Alias = Synthetic;\n"], ['apps/web/src/lib/events/declared-runtime.ts', 'export declare const declared: string;\nexport const runtime = true;\n'], ['apps/web/src/lib/events/declared-runtime.test.ts', 'export {};\n'], ['apps/web/src/lib/events/event-redaction.ts', "export { redactEventPayload } from './redact-event-payload';\n"], ['apps/web/src/lib/events/event-redaction.test.ts', 'export {};\n'], ['apps/web/src/scripts/process-domain-events.ts', "import 'dotenv/config';\nimport { pathToFileURL } from 'node:url';\nimport { createServiceClient } from '@/lib/supabase/service';\nimport { runDomainEventWorker as run } from './domain-event-worker';\nexport { processDomainEventBatch } from './domain-event-worker-batch';\nasync function runDomainEventWorker() { await run(createServiceClient('event-pipeline'), options); }\nexport { runDomainEventWorker };\nconst invokedPath = pathToFileURL(process.argv[1]).href;\nif (import.meta.url === invokedPath) runDomainEventWorker();\n"], ['apps/web/src/scripts/process-domain-events.test.ts', 'export {};\n'], ['apps/web/src/app/api/events/route.test-support.ts', 'export const first = true;\nexport const second = true;\n']] as const) write(root, path, source);

    expect(verify(root, baseSha)).toEqual([]);
  });

  // biome-ignore format: export shapes stay compact under the verifier gate.
  it.each([['declarations', 'export function first() {}\nexport const second = true;\n', 'first, second'], ['a default assignment', 'export default true;\nexport const second = true;\n', 'default, second'], ['a destructured binding', 'export const { first, second } = { first: true, second: true };\n', 'first, second'], ['a namespace', 'export namespace Scope {}\nexport const second = true;\n', 'Scope, second']])('rejects multiple primary runtime exports from %s', (_, source, names) => {
    const { baseSha, root } = fixtureRepository();
    const path = 'apps/web/src/lib/events/multi-primary.ts';
    write(root, path, source);
    write(root, path.replace('.ts', '.test.ts'), 'export {};\n');

    expect(verify(root, baseSha)).toContain(
      `${path}: multiple runtime exports ${names}`
    );
  });

  it('rejects local export lists, unnamed facades, and malformed CLIs', () => {
    const { baseSha, root } = fixtureRepository();
    const local = 'apps/web/src/lib/events/local-exports.ts';
    const facade = 'apps/web/src/lib/events/synthetic-facade.ts';
    const fakeCli = 'apps/web/src/scripts/process-domain-events.ts';
    write(
      root,
      local,
      'const first = true;\nconst second = true;\nexport { first, second };\n'
    );
    write(root, local.replace('.ts', '.test.ts'), 'export {};\n');
    write(root, facade, "export { run } from './runtime';\n");
    write(root, fakeCli.replace('.ts', '.test.ts'), 'export {};\n');
    // biome-ignore format: malformed CLI receipts stay compact under the verifier gate.
    const malformedClis = ["// import 'dotenv/config'; pathToFileURL; createServiceClient('event-pipeline'); import.meta.url === invokedPath\nexport const first = true;\nexport const second = true;\n", "import 'dotenv/config';\nimport { pathToFileURL as convert } from 'node:url';\nimport { createServiceClient } from '@/lib/supabase/service';\nfunction runDomainEventWorker() { createServiceClient('event-pipeline'); }\nexport const first = true;\nexport const second = true;\nconst invokedPath = convert(process.argv[1]).href;\nif (import.meta.url === invokedPath) runDomainEventWorker();\n", "import 'dotenv/config';\nimport { pathToFileURL } from 'node:url';\nimport { createServiceClient } from '@/lib/supabase/service';\nfunction runDomainEventWorker() { createServiceClient('event-pipeline'); }\nexport const first = true;\nexport const second = true;\nconst invokedPath = 'constant';\nif (import.meta.url === invokedPath) runDomainEventWorker();\n", "import 'dotenv/config';\nimport { pathToFileURL } from 'node:url';\nimport { createServiceClient } from '@/lib/supabase/service';\nfunction runDomainEventWorker() { createServiceClient('event-pipeline'); }\nexport const first = true;\nexport const second = true;\nconst invokedPath = pathToFileURL(process.argv[1]).href;\nrunDomainEventWorker();\nif (import.meta.url === invokedPath) console.log('not the worker');\n", "import 'dotenv/config';\nimport { pathToFileURL } from 'node:url';\nimport { createServiceClient } from '@/lib/supabase/service';\nfunction unrelated() { createServiceClient('event-pipeline'); }\nfunction runDomainEventWorker() {}\nexport const first = true;\nexport const second = true;\nconst invokedPath = pathToFileURL(process.argv[1]).href;\nif (import.meta.url === invokedPath) runDomainEventWorker();\n"];
    // biome-ignore format: repeated verifier invocation stays within the test's own 300-line gate.
    for (const source of malformedClis) {
      write(root, fakeCli, source);
      expect(verify(root, baseSha)).toContain(`${fakeCli}: multiple runtime exports first, second`);
    }
    // biome-ignore format: compact verifier invocation stays within the test's own 300-line gate.
    const findings = verify(root, baseSha);
    expect(findings).toContain(
      `${local}: multiple runtime exports first, second`
    );
    expect(findings).toContain(`${facade}: unauthorized thin re-export facade`);
    expect(findings).toContain(
      `${fakeCli}: multiple runtime exports first, second`
    );
  });

  it('counts SQL, shell, config, tests, CRLF, and unterminated lines', () => {
    const { baseSha, root } = fixtureRepository();
    // biome-ignore format: extension coverage is clearer as one compact vector.
    const paths = ['supabase/tests/domain_event_oversized.sql', 'supabase/tests/event_delivery_oversized.sql', 'apps/web/tools/events/oversized.sh', 'apps/web/tsconfig.tools-workers.json', 'apps/web/src/lib/events/oversized-worker.test.ts'];
    write(root, paths[0] ?? '', 'select 1;\r\n'.repeat(301));
    write(root, paths[1] ?? '', 'select 1;\n'.repeat(301));
    write(root, paths[2] ?? '', '# boundary\n'.repeat(301));
    write(root, paths[3] ?? '', `${'{}\n'.repeat(300)}{}`);
    write(root, paths[4] ?? '', `${'// boundary\n'.repeat(300)}// end`);

    const findings = verify(root, baseSha);

    for (const path of paths) {
      expect(findings).toContain(`${path}: exceeds 300 lines (301)`);
    }
  });

  it('grandfathers only the exact prior authority aggregate paths', () => {
    const { baseSha, root } = fixtureRepository();
    for (const path of grandfatheredAggregatePaths) {
      // biome-ignore format: repeated fixture bodies stay compact under the verifier gate.
      write(root, path, 'export const first = true;\nexport const second = true;\n');
      write(root, path.replace('.ts', '.test.ts'), 'export {};\n');
    }
    const unlisted = 'apps/web/tools/events/unlisted-authority-aggregate.ts';
    // biome-ignore format: repeated fixture bodies stay compact under the verifier gate.
    write(root, unlisted, 'export const first = true;\nexport const second = true;\n');
    write(root, unlisted.replace('.ts', '.test.ts'), 'export {};\n');
    git(root, ['add', '.']);

    const findings = verify(root, baseSha);

    for (const path of grandfatheredAggregatePaths) {
      expect(findings).not.toContain(
        `${path}: multiple runtime exports first, second`
      );
    }
    expect(findings).toContain(
      `${unlisted}: multiple runtime exports first, second`
    );
  });

  it('still checks grandfathered paths for size, parsing, and tests', () => {
    const { baseSha, root } = fixtureRepository();
    const path = 'apps/web/src/lib/events/event-pipeline-database.ts';
    // biome-ignore format: oversized malformed fixture construction stays compact.
    write(root, path, `${'// boundary\n'.repeat(300)}export function broken( {`);

    const findings = verify(root, baseSha);

    expect(findings).toContain(`${path}: exceeds 300 lines (301)`);
    expect(findings).toContain(`${path}: TypeScript parse error`);
    expect(findings).toContain(
      `${path}: runtime source is missing colocated test ${path.replace('.ts', '.test.ts')}`
    );
  });
});
