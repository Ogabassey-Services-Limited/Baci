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
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

async function fixture(name) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), name)));
  const units = join(directory, 'units');
  const binaries = join(directory, 'usr-local-bin');
  await Promise.all([mkdir(units), mkdir(binaries)]);
  return { binaries, directory, units };
}

function scan(units, binaries) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}binary_root=$3; getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; systemd_default_binary_directories() { printf '%s\\n' "$binary_root"; }; SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
    'retire-ollama-systemd-simple-executable-test',
    script.pathname,
    units,
    binaries,
  ]);
}

test('binds a simple-name executable from the fixed systemd search path', async () => {
  const { binaries, directory, units } = await fixture(
    'baci-systemd-simple-executable-'
  );
  const unit = join(units, 'application.service');
  const wrapper = join(binaries, 'application-worker');
  try {
    await Promise.all([
      writeFile(unit, '[Service]\nExecStart=application-worker\n'),
      writeFile(
        wrapper,
        '#!/bin/sh\nexec /usr/bin/curl http://127.0.0.1:11434\n'
      ),
    ]);
    await chmod(wrapper, 0o755);

    const { stdout } = await scan(units, binaries);

    assert.match(stdout, new RegExp(`^${unit}\\|.*\\|${wrapper}\\|`, 'm'));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('fails closed when a simple-name executable is absent from the systemd search path', async () => {
  const { binaries, directory, units } = await fixture(
    'baci-systemd-missing-simple-executable-'
  );
  try {
    await writeFile(
      join(units, 'application.service'),
      '[Service]\nExecStart=missing-application-worker\n'
    );

    await assert.rejects(scan(units, binaries), (error) => error.code === 2);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
