import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const closure = new URL('./retire-ollama-consumer-closure.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:0:0:600\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('binds config passed by an assignment-prefixed systemd wrapper', async () => {
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
        '#!/bin/sh\nMODE=prod exec /usr/bin/worker --config=/etc/application.conf\n',
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

test('fails closed on unmodeled slash tokens in a systemd wrapper', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-wrapper-slash-token-'))
  );
  const wrapper = join(directory, 'wrapper');
  try {
    for (const line of [
      'exec /usr/bin/worker config/application.conf',
      'exec /usr/bin/worker --bad@=/etc/secret',
    ]) {
      await writeFile(wrapper, `#!/bin/sh\n${line}\n`, { mode: 0o755 });
      await assert.rejects(
        execFileAsync('sh', [
          '-c',
          '. "$1"; systemd_wrapper_exec_paths "$2"',
          'retire-ollama-systemd-wrapper-slash-token-test',
          closure.pathname,
          wrapper,
        ]),
        (error) => error.code === 2
      );
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
