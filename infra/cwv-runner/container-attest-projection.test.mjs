import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const scriptUrl = new URL('./container-attest.sh', import.meta.url);
const source = () => readFile(scriptUrl, 'utf8');

function projectionMatcher(shell) {
  const start = shell.indexOf('projection_is_exact() {');
  const end = shell.indexOf('\nimage_id()', start);
  assert.ok(start >= 0 && end > start, 'projection matcher is present');
  return shell.slice(start, end);
}

test('runtime attestation wrapper pins its empty HOME', async () => {
  const shell = await source();

  assert.match(shell, /^HOME=\/var\/empty\/baci-cwv$/m);
  assert.match(shell, /export PATH LC_ALL TZ HOME/);
});

test('projection matcher accepts the fixed runtime projection after sort', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-container-attest-'));
  const projection = join(root, 'runtime-runner-binaries');
  context.after(async () => {
    await chmod(projection, 0o755);
    await rm(root, { force: true, recursive: true });
  });
  await mkdir(join(projection, 'bin'), { recursive: true });
  for (const path of [
    'bin/Runner.Listener',
    'bin/Runner.Worker',
    'entrypoint.mjs',
    'identity-contract.json',
    'runtime-manifest.json',
  ])
    await writeFile(join(projection, path), 'sealed');
  await chmod(projection, 0o555);

  const matcher = projectionMatcher(await source())
    .replace(
      '/usr/bin/stat -c \'%u:%g:%a\' -- "$PROJECTION"',
      'projection_stat "$PROJECTION"'
    )
    .replace(
      '/usr/bin/find "$PROJECTION" -xdev -printf \'%P:%y\\n\'',
      'projection_members "$PROJECTION"'
    );
  const result = spawnSync(
    '/bin/sh',
    [
      '-ceu',
      `LC_ALL=C.UTF-8; export LC_ALL\nprojection_stat() { /usr/bin/printf '%s\\n' '0:0:555'; }\nprojection_members() { /usr/bin/printf '%s\\n' ':d' 'bin:d' 'bin/Runner.Listener:f' 'bin/Runner.Worker:f' 'entrypoint.mjs:f' 'identity-contract.json:f' 'runtime-manifest.json:f'; }\nPROJECTION=${JSON.stringify(projection)}\n${matcher}\nprojection_is_exact`,
    ],
    {
      encoding: 'utf8',
      env: { HOME: '/hostile-home', LC_ALL: 'de_DE.UTF-8', PATH: '/hostile' },
    }
  );
  assert.equal(result.status, 0, result.stderr);
});
