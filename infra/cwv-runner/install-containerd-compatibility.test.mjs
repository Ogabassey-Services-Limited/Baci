import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const sourcePath = new URL('./install.sh', import.meta.url);
const identityContractPath = new URL(
  './identity-contract.json',
  import.meta.url
);

test('reads the checked-in identity schema before accepting the pinned containerd release', async (context) => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-cwv-containerd-version-')
  );
  context.after(() => rm(directory, { force: true, recursive: true }));
  const containerd = join(directory, 'containerd');
  const install = join(directory, 'install.sh');
  await writeFile(
    join(directory, 'identity-contract.json'),
    await readFile(identityContractPath)
  );
  const source = await readFile(sourcePath, 'utf8');
  assert.match(
    source,
    /prepare\(\) \{\n {2}\[ "\$#" -eq 8 \] \|\| die 'invalid prepare arguments'; assert_bootstrap; assert_containerd_compatible/
  );
  const bootstrap = source.replace(
    /bootstrap\(\) \{[\s\S]*?^\}\nassert_bootstrap/m,
    'bootstrap() {\n  assert_containerd_compatible\n  : >"$SCRIPT_DIR/mutated"\n}\nassert_bootstrap'
  );
  await writeFile(
    install,
    bootstrap
      .replaceAll('/usr/bin/containerd', containerd)
      .replace(/^root_required\ncase /m, ':\ncase ')
  );
  await chmod(install, 0o755);
  const run = async (version) => {
    await writeFile(
      containerd,
      `#!/bin/sh\nprintf '%s\\n' 'containerd github.com/containerd/containerd v${version} build'\n`
    );
    await chmod(containerd, 0o755);
    return spawnSync(
      '/bin/sh',
      [
        install,
        '--bootstrap-control',
        '--source-sha',
        'a'.repeat(40),
        '--source-manifest',
        '/unused',
        '--source-manifest-sha256',
        '/unused',
      ],
      { encoding: 'utf8' }
    );
  };
  const rejected = await run('1.7.0');
  assert.equal(rejected.status, 65);
  assert.match(rejected.stderr, /containerd version refused/);
  await assert.rejects(readFile(join(directory, 'mutated')));
  const accepted = await run('2.2.6');
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(await readFile(join(directory, 'mutated'), 'utf8'), '');
});
