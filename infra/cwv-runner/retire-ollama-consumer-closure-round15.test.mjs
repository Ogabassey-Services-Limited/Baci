import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

function scanCompose(root, bin) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
      'retire-ollama-compose-inline-boundary-test',
      script.pathname,
      root,
    ],
    { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
  );
}

function scanSystemd(root) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
    'retire-ollama-systemd-closure-round15-test',
    script.pathname,
    root,
  ]);
}

test('fails closed instead of sharing stage aliases across inline Dockerfiles', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-inline-stage-boundary-'))
  );
  const bin = join(root, 'bin');
  try {
    await mkdir(bin);
    await Promise.all([
      writeFile(
        join(root, 'compose.yaml'),
        'services:\n  first:\n    build:\n      dockerfile_inline: |\n        FROM alpine AS base\n  second:\n    build:\n      dockerfile_inline: |\n        FROM base\n'
      ),
      writeFile(
        join(bin, 'docker'),
        `#!/bin/sh
case "$*" in
  *'image inspect -f '*' alpine') printf '%s\\n' 'sha256:${'a'.repeat(64)} [] {} null [] []' ;;
  *'image inspect -f '*' base') printf '%s\\n' 'sha256:${'b'.repeat(64)} ["OLLAMA_HOST=http://127.0.0.1:11434"] {} null [] []' ;;
  *) exit 64 ;;
esac
`
      ),
    ]);
    await Promise.all([chmod(join(bin, 'docker'), 0o755), chmod(bin, 0o755)]);

    await assert.rejects(scanCompose(root, bin), (error) => error.code === 2);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('fails closed for an unloaded unit symlinked drop-in', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-symlinked-dropin-'))
  );
  const root = join(directory, 'units');
  const dropins = join(root, 'application.service.d');
  const override = join(directory, 'override.conf');
  try {
    await mkdir(dropins, { recursive: true });
    await Promise.all([
      writeFile(
        join(root, 'application.service'),
        '[Service]\nExecStart=/bin/true\n'
      ),
      writeFile(
        override,
        '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11434\n'
      ),
    ]);
    await symlink(override, join(dropins, 'override.conf'));

    await assert.rejects(scanSystemd(root), (error) => error.code === 2);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds a statically resolvable absolute exec target from a stopped wrapper', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-wrapper-exec-'))
  );
  const root = join(directory, 'units');
  const unit = join(root, 'application.service');
  const launcher = join(directory, 'launcher');
  const worker = join(directory, 'application-worker');
  try {
    await mkdir(root);
    await Promise.all([
      writeFile(unit, `[Service]\nExecStart=${launcher}\n`),
      writeFile(launcher, `#!/bin/sh\nexec ${worker}\n`),
      writeFile(worker, '#!/bin/sh\ncurl http://127.0.0.1:11434\n'),
    ]);
    await Promise.all([chmod(launcher, 0o755), chmod(worker, 0o755)]);

    const { stdout } = await scanSystemd(root);
    assert.match(stdout, new RegExp(`^${unit}\\|.*\\|${worker}\\|`, 'm'));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
