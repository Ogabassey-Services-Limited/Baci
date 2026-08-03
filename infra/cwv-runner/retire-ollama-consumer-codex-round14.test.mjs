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
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

async function systemdFixture(name) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), name)));
  const root = join(directory, 'units');
  await mkdir(root);
  return { directory, root };
}

function scanSystemd(root) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
    'retire-ollama-systemd-round14-test',
    script.pathname,
    root,
  ]);
}

test('binds a stopped unit encrypted credential even when ciphertext hides the endpoint', async () => {
  const { directory, root } = await systemdFixture(
    'baci-systemd-encrypted-credential-'
  );
  const unit = join(root, 'application.service');
  const credential = join(directory, 'application.cred');
  try {
    await Promise.all([
      writeFile(
        unit,
        `[Service]\nLoadCredentialEncrypted=application.conf:${credential}\nExecStart=/bin/true\n`
      ),
      writeFile(credential, 'opaque-encrypted-bytes\n'),
    ]);

    const { stdout } = await scanSystemd(root);

    assert.match(stdout, new RegExp(`^${unit}\\|.*\\|${credential}\\|`, 'm'));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('rejects a stopped unit encrypted credential with a relative source', async () => {
  const { directory, root } = await systemdFixture(
    'baci-systemd-relative-encrypted-credential-'
  );
  try {
    await writeFile(
      join(root, 'application.service'),
      '[Service]\nLoadCredentialEncrypted=application.conf:relative.cred\nExecStart=/bin/true\n'
    );

    await assert.rejects(scanSystemd(root), (error) => error.code === 2);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds an active unit encrypted credential without searching its ciphertext', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-runtime-encrypted-'))
  );
  const credential = join(directory, 'application.cred');
  try {
    await writeFile(credential, 'opaque-encrypted-bytes\n');

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; scan_systemd_runtime_encrypted_credentials application.service "application.conf:$2"`,
      'retire-ollama-systemd-runtime-encrypted-test',
      script.pathname,
      credential,
    ]);

    assert.match(
      stdout,
      new RegExp(`^application\\.service:.*\\|${credential}\\|`, 'm')
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('enumerates a safe absolute regular-file ExecStart argument with its executable', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-exec-argument-'))
  );
  const wrapper = join(directory, 'application-worker');
  const configuration = join(directory, 'application.conf');
  try {
    await Promise.all([
      writeFile(wrapper, '#!/bin/sh\nexec /bin/true\n'),
      writeFile(configuration, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
    ]);

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_quoted_command_paths "$2 --config $3"`,
      'retire-ollama-systemd-argument-test',
      script.pathname,
      wrapper,
      configuration,
    ]);

    assert.deepEqual(stdout.trim().split('\n'), [wrapper, configuration]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
