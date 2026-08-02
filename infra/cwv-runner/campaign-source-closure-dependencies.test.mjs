import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { init, parse } from 'es-module-lexer';
import { campaignSourceClosure as closure } from './campaign-source-closure.mjs';

const read = (name) => fs.readFile(new URL(name, import.meta.url), 'utf8');

const repositoryManifest = async () =>
  JSON.parse(await read('../../package.json'));

const rootLockImporter = async () => {
  const lockfile = await read('../../pnpm-lock.yaml');
  const start = lockfile.indexOf('  .:\n', lockfile.indexOf('importers:\n'));
  const end = lockfile.indexOf('\n  apps/mobile-admin:', start);
  return lockfile.slice(start, end);
};

await init;

const localSourceDependencies = (source) =>
  parse(source)[0]
    .map(({ n, d }) => {
      if (d >= 0 && !n) throw Error('nonliteral dynamic import');
      return n;
    })
    .filter(
      (specifier) => specifier?.startsWith('./') || specifier?.startsWith('../')
    )
    .map((specifier) => {
      const dependency = path.posix.normalize(specifier);
      if (dependency.startsWith('../') || dependency.includes('/'))
        throw new Error(
          `local source dependency escapes the flat closure: ${specifier}`
        );
      return dependency;
    });

const shellSourceDependencies = (source) =>
  [
    ...source.matchAll(
      /\$(?:\{SCRIPT_DIR\}|SCRIPT_DIR)\/((?:\.\.\/|\.\/)?[A-Za-z0-9._-]+)/g
    ),
  ].map((match) => {
    const dependency = path.posix.normalize(match[1]);
    if (dependency.startsWith('../') || dependency.includes('/'))
      throw new Error(
        `shell source dependency escapes the flat closure: ${match[1]}`
      );
    return dependency;
  });

test('detects bare side-effect imports as local source dependencies', () => {
  assert.deepEqual(
    localSourceDependencies("import './unbound-side-effect.mjs';\n"),
    ['unbound-side-effect.mjs']
  );
  assert.throws(
    () => localSourceDependencies("import '../outside-the-closure.mjs';\n"),
    /escapes the flat closure/
  );
});

test('declares es-module-lexer directly for campaign source parsing', async () => {
  const manifest = await repositoryManifest();

  assert.equal(manifest.devDependencies['es-module-lexer'], '^2.3.1');
  assert.match(
    await rootLockImporter(),
    / {6}es-module-lexer:\n {8}specifier: \^2\.3\.1\n {8}version: 2\.3\.1\n/
  );
});

test('detects shell sibling dependencies and rejects parent traversal', () => {
  for (const directory of ['$SCRIPT_DIR', '${' + 'SCRIPT_DIR}'])
    assert.deepEqual(
      shellSourceDependencies(`STATE_TOOL="${directory}/campaign-state.mjs"`),
      ['campaign-state.mjs']
    );
  for (const directory of ['$SCRIPT_DIR', '${' + 'SCRIPT_DIR}'])
    assert.throws(
      () => shellSourceDependencies(`source "${directory}/../outside.sh"`),
      /escapes the flat closure/
    );
});

test('binds the exact reviewed non-module campaign source inventory', () => {
  assert.deepEqual(
    closure.filter((entry) => !entry.endsWith('.mjs')),
    [
      'campaign-lease-holder.sh',
      'campaign-quiesce.sh',
      'exact-run-terminal-cleanup.sh',
      'campaign-restore-post-commit.sh',
      'campaign-restore-terminal-receipt.sh',
      'campaign-restore.sh',
      'campaign-watchdog.sh',
      'cron-inventory.json',
      'policy.json',
    ]
  );
});

test('discovers comment-separated static imports and exports plus literal dynamic imports', () => {
  assert.deepEqual(
    localSourceDependencies(`
      import/* comment */ './commented-import.mjs';
      import { imported } from './ordinary-import.mjs';
      export { imported } from './ordinary-export.mjs';
      export { imported } from /* comment */ './commented-export.mjs';
      export * from './ordinary-export-all.mjs';
      void import('./literal-dynamic.mjs');
      const sourceLikeString = "import './not-a-dependency.mjs'";
      // export { imported } from './also-not-a-dependency.mjs';
      /* void import('./not-dynamic.mjs'); */
    `),
    [
      'commented-import.mjs',
      'ordinary-import.mjs',
      'ordinary-export.mjs',
      'commented-export.mjs',
      'ordinary-export-all.mjs',
      'literal-dynamic.mjs',
    ]
  );
});

test('rejects nonliteral dynamic imports', () => {
  for (const source of [
    "void import('./' + dependency);",
    `void import(\`./\${dependency}.mjs\`);`,
  ])
    assert.throws(
      () => localSourceDependencies(source),
      /nonliteral dynamic import/
    );
});

test('campaign sources use one transitive physical-path closure', async () => {
  const [quiesce, watchdog, restore] = await Promise.all([
    read('./campaign-quiesce.sh'),
    read('./campaign-watchdog.sh'),
    read('./campaign-restore.sh'),
  ]);
  for (const source of [quiesce, watchdog, restore])
    assert.match(source, /SOURCE_CLOSURE=.*campaign-source-closure\.mjs/);
  for (const name of [
    'campaign-state-collisions.mjs',
    'campaign-state-journal-lock.mjs',
    'campaign-traffic.mjs',
    'campaign-terminal-cleanup.mjs',
    'exact-run-terminal-cleanup.sh',
    'campaign-restore-post-commit.sh',
    'campaign-restore-terminal-receipt.sh',
    'registration-token-mount.mjs',
    'registration-root-restoration.mjs',
    'install-prepare-runtime-receipt.mjs',
    'archive-index.mjs',
    'rootfs-source-membership.mjs',
    'rootfs-source-membership-input.mjs',
    'source-tree-projection.mjs',
  ])
    assert.ok(closure.includes(name), `${name} is transitively source-bound`);
  const closureSet = new Set(closure);
  for (const name of closure.filter(
    (entry) => entry.endsWith('.mjs') || entry.endsWith('.sh')
  )) {
    const source = await read(`./${name}`);
    const dependencies = name.endsWith('.mjs')
      ? localSourceDependencies(source)
      : shellSourceDependencies(source);
    for (const dependency of dependencies)
      assert.ok(
        closureSet.has(dependency),
        `${name} imports unbound campaign source ${dependency}`
      );
  }
  const holder = await read('./campaign-lease-holder.sh');
  assert.match(holder, /\/proc\/\$\$\/fd\/9.*\$LOCK/);
  assert.match(holder, /flock -n 9/);
  assert.match(
    holder,
    /holderPid.*holderStartTime.*lockDevice.*lockInode.*token/s
  );
});
