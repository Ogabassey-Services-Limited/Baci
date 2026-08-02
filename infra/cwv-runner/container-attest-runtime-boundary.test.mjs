import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { collectRuntimeIdentity } from './container-attest-runtime.mjs';

const imageId = `sha256:${'a'.repeat(64)}`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSource = new URL('canonical-json.mjs', import.meta.url);
const ambientEnvironmentKey = 'UNSAFE_RUNTIME_ENV';

function write(path, contents, mode = 0o644) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, { mode });
}

function command(output, variant) {
  const environmentCheck = `if [ "\${UNSAFE_RUNTIME_ENV+x}" = x ]; then exit 97; fi
`;
  if (variant === 'exit') return `#!/bin/sh\n${environmentCheck}exit 1\n`;
  if (variant === 'hang')
    return `#!/bin/sh\n${environmentCheck}exec /bin/sleep 30\n`;
  if (variant === 'stderr')
    return `#!/bin/sh\n${environmentCheck}printf 'unexpected\\n' >&2\nprintf '${output}\\n'\n`;
  if (variant === 'stdout')
    return `#!/bin/sh\n${environmentCheck}i=0; while [ "$i" -lt 700 ]; do printf 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; i=$((i + 1)); done\n`;
  return `#!/bin/sh\n${environmentCheck}printf '${output}\\n'\n`;
}

function runtimeFixture(variant = '') {
  const root = mkdtempSync(join(tmpdir(), 'cwv-runtime-boundary-'));
  const chrome = join(root, 'opt/google/chrome/chrome');
  const node = join(root, 'opt/node/bin/node');
  const pnpm = join(root, 'opt/pnpm/bin/pnpm.cjs');
  const listener = join(root, 'opt/runner/bin/Runner.Listener');
  const dpkgQuery = join(root, 'usr/bin/dpkg-query');
  const packageJson = join(root, 'opt/pnpm/package.json');
  const runtimeContract = {
    chrome: {
      debianPackage: {
        architecture: 'amd64',
        name: 'google-chrome-stable',
        version: '150.0.0',
      },
      debianSha256: 'b'.repeat(64),
      targetPath: '/opt/google/chrome/chrome',
      version: '150.0.0',
    },
    node: { version: '24.0.0' },
    pnpm: {
      packageProjection: {
        bin: 'bin/pnpm.cjs',
        name: 'pnpm',
        version: '10.0.0',
      },
      version: '10.0.0',
    },
    runnerFiles: ['bin/Runner.Listener'],
    runnerVersion: '2.3.4',
  };
  write(chrome, command('Google Chrome 150.0.0', variant), 0o755);
  write(
    node,
    `#!/bin/sh\nif [ "\${UNSAFE_RUNTIME_ENV+x}" = x ]; then exit 97; fi\nif [ "$1" = '--version' ]; then printf 'v24.0.0\\n'; else printf '10.0.0\\n'; fi\n`,
    0o755
  );
  write(pnpm, 'fixture pnpm program');
  write(listener, command('2.3.4', ''), 0o755);
  write(
    dpkgQuery,
    command('google-chrome-stable\\t150.0.0\\tamd64', ''),
    0o755
  );
  write(packageJson, canonicalJson(runtimeContract.pnpm.packageProjection));
  const canonicalDestination = join(root, 'opt/baci-cwv/canonical-json.mjs');
  mkdirSync(dirname(canonicalDestination), { recursive: true });
  copyFileSync(canonicalSource, canonicalDestination);
  chmodSync(canonicalDestination, 0o644);
  mkdirSync(join(root, 'usr/bin'), { recursive: true });
  symlinkSync(
    '/opt/google/chrome/chrome',
    join(root, 'usr/bin/google-chrome-stable')
  );
  const runtime = {
    chrome: {
      binarySha256: sha256(command('Google Chrome 150.0.0', variant)),
      debianPackage: runtimeContract.chrome.debianPackage,
      debianSha256: runtimeContract.chrome.debianSha256,
      version: runtimeContract.chrome.version,
    },
    imageId,
    node: { binarySha256: sha256(requireFile(node)), version: '24.0.0' },
    pnpm: {
      binarySha256: sha256(requireFile(pnpm)),
      packageJsonSha256: sha256(requireFile(packageJson)),
      packageProjection: runtimeContract.pnpm.packageProjection,
      version: '10.0.0',
    },
    runtimeRunner: {
      files: [
        { path: 'bin/Runner.Listener', sha256: sha256(requireFile(listener)) },
      ],
      version: '2.3.4',
    },
    schemaVersion: 1,
  };
  runtime.runtimeRunnerBinaryDigest = sha256(
    canonicalJson(runtime.runtimeRunner)
  );
  write(
    join(root, 'opt/runner/identity-contract.json'),
    canonicalJson({
      builderSources: {
        runtime: {
          keys: [
            'chrome',
            'imageId',
            'node',
            'pnpm',
            'runtimeRunner',
            'runtimeRunnerBinaryDigest',
            'schemaVersion',
          ],
          ...runtimeContract,
        },
      },
    })
  );
  write(
    join(root, 'opt/runner/runtime-manifest.json'),
    canonicalJson({
      chromeTargetPath: runtimeContract.chrome.targetPath,
      pnpmPackage: runtimeContract.pnpm.packageProjection,
      runtime,
      schemaVersion: 1,
    })
  );
  return root;
}

function requireFile(path) {
  return readFileSync(path);
}

test('executes fake runtime probes with no inherited environment', async (t) => {
  const root = runtimeFixture();
  t.after(() => rmSync(root, { force: true, recursive: true }));
  process.env[ambientEnvironmentKey] = 'ambient';
  try {
    const receipt = await collectRuntimeIdentity(root, imageId);
    assert.equal(receipt.source, 'runtime');
  } finally {
    delete process.env[ambientEnvironmentKey];
  }
});

for (const [variant, expected] of [
  ['stderr', /runtime command stderr drift/],
  ['exit', /runtime command exit drift/],
  ['stdout', /runtime command output drift/],
  ['hang', /runtime command timeout/],
]) {
  test(`refuses a fake runtime command with ${variant} drift`, (t) => {
    const root = runtimeFixture(variant);
    t.after(() => rmSync(root, { force: true, recursive: true }));
    assert.throws(() => collectRuntimeIdentity(root, imageId), expected);
  });
}
