import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './canonical-json.mjs';

const runtimeCollector = fileURLToPath(
  new URL('./container-attest-runtime.mjs', import.meta.url)
);
const contract = JSON.parse(
  await readFile(new URL('./identity-contract.json', import.meta.url), 'utf8')
);
const pnpmPackageProjection =
  contract.builderSources.runtime.pnpm.packageProjection;
export const fixtureImageId = `sha256:${'a'.repeat(64)}`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
async function writeFixtureFile(root, path, value, executable = false) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value);
  if (executable) await chmod(target, 0o755);
  return { path: target, sha256: sha256(value) };
}

export async function runtimeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'baci-runtime-attest-'));
  const pnpmProgramPath = join(root, 'opt/pnpm', pnpmPackageProjection.bin);
  const nodeBytes = `#!/bin/sh
if [ "$1" = "--version" ]; then echo "v24.18.0"; exit 0; fi
if [ "$1" = "${pnpmProgramPath}" ] && [ "$2" = "--version" ]; then echo "11.7.0"; exit 0; fi
exit 64
`;
  const packageBytes = `${JSON.stringify({
    ...pnpmPackageProjection,
    bin: { pnpm: pnpmPackageProjection.bin },
  })}\n`;
  await writeFixtureFile(
    root,
    'opt/baci-cwv/canonical-json.mjs',
    await readFile(new URL('./canonical-json.mjs', import.meta.url), 'utf8')
  );
  await writeFixtureFile(
    root,
    'opt/runner/identity-contract.json',
    JSON.stringify(contract)
  );
  const chrome = await writeFixtureFile(
    root,
    'opt/google/chrome/google-chrome',
    '#!/bin/sh\necho "Google Chrome 150.0.7871.128"\n',
    true
  );
  await mkdir(join(root, 'usr/bin'), { recursive: true });
  await symlink(
    '/opt/google/chrome/google-chrome',
    join(root, 'usr/bin/google-chrome-stable')
  );
  const node = await writeFixtureFile(
    root,
    'opt/node/bin/node',
    nodeBytes,
    true
  );
  await writeFixtureFile(
    root,
    'usr/bin/dpkg-query',
    '#!/bin/sh\nprintf "google-chrome-stable\\t150.0.7871.128-1\\tamd64\\n"\n',
    true
  );
  const pnpm = await writeFixtureFile(
    root,
    'opt/pnpm/bin/pnpm.cjs',
    'pnpm program\n'
  );
  const packageJson = await writeFixtureFile(
    root,
    'opt/pnpm/package.json',
    packageBytes
  );
  const listener = await writeFixtureFile(
    root,
    'opt/runner/bin/Runner.Listener',
    '#!/bin/sh\necho "2.335.1"\n',
    true
  );
  const worker = await writeFixtureFile(
    root,
    'opt/runner/bin/Runner.Worker',
    'runner worker\n'
  );
  const lifecycle = await writeFixtureFile(
    root,
    'opt/runner/entrypoint.mjs',
    'entrypoint lifecycle\n'
  );
  const runtimeRunner = {
    files: [
      { path: 'bin/Runner.Listener', sha256: listener.sha256 },
      { path: 'bin/Runner.Worker', sha256: worker.sha256 },
      { path: 'entrypoint.mjs', sha256: lifecycle.sha256 },
    ],
    version: '2.335.1',
  };
  const runtime = {
    chrome: {
      binarySha256: chrome.sha256,
      debianPackage: contract.builderSources.runtime.chrome.debianPackage,
      debianSha256:
        '83ed59c85878ebb8fa53915ebe7066cafc58d1c04c1c95449486e6f9d99a1efb',
      version: '150.0.7871.128',
    },
    imageId: fixtureImageId,
    node: { binarySha256: node.sha256, version: '24.18.0' },
    pnpm: {
      binarySha256: pnpm.sha256,
      packageJsonSha256: packageJson.sha256,
      packageProjection: pnpmPackageProjection,
      version: '11.7.0',
    },
    runtimeRunner,
    runtimeRunnerBinaryDigest: sha256(canonicalJson(runtimeRunner)),
    schemaVersion: 1,
  };
  await writeFixtureFile(
    root,
    'opt/runner/runtime-manifest.json',
    canonicalJson({
      chromeTargetPath: '/opt/google/chrome/google-chrome',
      pnpmPackage: pnpmPackageProjection,
      runtime,
      schemaVersion: 1,
    })
  );
  return { root, runtime };
}

export function runFixture(root, imageId = fixtureImageId) {
  return spawnSync(process.execPath, [runtimeCollector, root, imageId], {
    encoding: 'utf8',
    timeout: 15_000,
  });
}
