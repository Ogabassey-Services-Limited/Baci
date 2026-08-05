import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:755\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

function scanSystemd(root) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
    'retire-ollama-systemd-round19-test',
    script.pathname,
    root,
  ]);
}

async function fixture(body) {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-absolute-chain-'))
  );
  const root = join(directory, 'units');
  const unit = join(root, 'application.service');
  const launcher = join(directory, 'application-launcher');
  const worker = join(directory, 'application-worker');
  await mkdir(root);
  await Promise.all([
    writeFile(unit, `[Service]\nExecStart=${launcher}\n`),
    writeFile(launcher, `#!/bin/sh\n${body(worker)}\n`),
    writeFile(worker, '#!/bin/sh\ncurl http://127.0.0.1:11434\n'),
  ]);
  await Promise.all([chmod(launcher, 0o755), chmod(worker, 0o755)]);
  return { directory, launcher, root, unit, worker };
}

test('traverses a generic launcher absolute executable chain to Ollama', async () => {
  const value = await fixture((worker) => worker);
  try {
    const { stdout } = await scanSystemd(value.root);
    assert.match(
      stdout,
      new RegExp(`^${value.unit}\\|.*\\|${value.worker}\\|`, 'm')
    );
  } finally {
    await rm(value.directory, { force: true, recursive: true });
  }
});

test('fails closed on a dynamic generic launcher executable', async () => {
  const value = await fixture(() => '"$APPLICATION_WORKER"');
  try {
    await assert.rejects(scanSystemd(value.root), (error) => error.code === 2);
  } finally {
    await rm(value.directory, { force: true, recursive: true });
  }
});
