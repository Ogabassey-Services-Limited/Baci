import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:0:0:600\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('binds an option-embedded config passed to a systemd wrapper child', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-wrapper-argument-'))
  );
  const units = join(directory, 'units');
  const root = join(directory, 'root');
  const wrapper = join(root, 'usr/bin/wrapper');
  const worker = join(root, 'usr/bin/worker');
  const config = join(root, 'etc/application.conf');
  try {
    await Promise.all([
      mkdir(units),
      mkdir(join(root, 'usr/bin'), { recursive: true }),
      mkdir(join(root, 'etc'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        join(units, 'application.service'),
        `[Service]\nRootDirectory=${root}\nExecStart=/usr/bin/wrapper\n`
      ),
      writeFile(
        wrapper,
        '#!/bin/sh\nexec /usr/bin/worker --config=/etc/application.conf\n',
        { mode: 0o755 }
      ),
      writeFile(worker, '#!/bin/sh\nexit 0\n', { mode: 0o755 }),
      writeFile(config, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
    ]);

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
      'retire-ollama-systemd-wrapper-argument-test',
      script.pathname,
      units,
    ]);

    assert.match(stdout, new RegExp(`\\|${config}\\|`));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
