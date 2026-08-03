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
    'retire-ollama-systemd-round11-test',
    script.pathname,
    root,
  ]);
}

test('binds a stopped systemd wrapper when ExecStart has a quoted argument', async () => {
  const { directory, root } = await systemdFixture(
    'baci-systemd-quoted-wrapper-'
  );
  const unit = join(root, 'application.service');
  const wrapper = join(directory, 'application-worker');
  try {
    await Promise.all([
      writeFile(unit, `[Service]\nExecStart=${wrapper} --label "some value"\n`),
      writeFile(
        wrapper,
        '#!/bin/sh\nexec /usr/bin/curl http://127.0.0.1:11434\n'
      ),
    ]);

    const { stdout } = await scanSystemd(root);

    assert.match(stdout, new RegExp(`^${unit}\\|.*\\|${wrapper}\\|`, 'm'));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds a local LoadCredential source used by a stopped systemd unit', async () => {
  const { directory, root } = await systemdFixture(
    'baci-systemd-load-credential-'
  );
  const unit = join(root, 'application.service');
  const wrapper = join(directory, 'application-worker');
  const credential = join(directory, 'application.conf');
  try {
    await Promise.all([
      writeFile(
        unit,
        `[Service]\nLoadCredential=application.conf:${credential}\nExecStart=${wrapper}\n`
      ),
      writeFile(wrapper, '#!/bin/sh\nexec /bin/true\n'),
      writeFile(credential, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
    ]);

    const { stdout } = await scanSystemd(root);

    assert.match(stdout, new RegExp(`^${unit}\\|.*\\|${credential}\\|`, 'm'));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds an exact runtime LoadCredential property and rejects a relative source', async () => {
  const { directory, root } = await systemdFixture(
    'baci-systemd-runtime-credential-'
  );
  const credential = join(directory, 'application.conf');
  const command = `${prelude}credential=$3; relative=$4; getent() { return 2; }; systemctl() { case "$1" in list-units) printf 'application.service loaded active running application\\n';; show) printf 'Environment=\\nEnvironmentFiles=\\nLoadCredential=application.conf:%s\\nStandardInput=null\\nExecStart={}\\n' "$credential";; *) return 0;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`;
  try {
    await writeFile(credential, 'OLLAMA_HOST=http://127.0.0.1:11434\n');

    const { stdout } = await execFileAsync('sh', [
      '-c',
      command,
      'retire-ollama-systemd-runtime-credential-test',
      script.pathname,
      root,
      credential,
      'no',
    ]);
    assert.match(
      stdout,
      new RegExp(`^application.service:.*\\|${credential}\\|`, 'm')
    );

    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        command,
        'retire-ollama-systemd-runtime-relative-credential-test',
        script.pathname,
        root,
        'relative.conf',
        'yes',
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds the immutable configuration of a Dockerfile FROM image', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-build-base-image-'))
  );
  const compose = join(directory, 'compose.yaml');
  const dockerfile = join(directory, 'Dockerfile');
  const digest = 'a'.repeat(64);
  try {
    await Promise.all([
      writeFile(compose, 'services:\n  app:\n    build: .\n'),
      writeFile(dockerfile, 'FROM application-base\n'),
    ]);

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}docker() { case "$*" in *"image inspect"*"application-base"*) printf 'sha256:${digest} {"Env":["OLLAMA_HOST=http://127.0.0.1:11434"]}\\n';; *) return 64;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; CANONICAL_DOCKER_SOCKET=/tmp/docker.sock; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
      'retire-ollama-compose-build-base-image-test',
      script.pathname,
      directory,
    ]);

    assert.match(stdout, new RegExp(`^compose-build-image:${compose}\\|`, 'm'));
    assert.match(stdout, new RegExp(`sha256:${digest}`));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
