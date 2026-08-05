import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
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

test('binds an Ollama configuration statically sourced by a stopped systemd wrapper', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-wrapper-source-'))
  );
  const root = join(directory, 'units');
  const unit = join(root, 'application.service');
  const wrapper = join(directory, 'application-wrapper');
  const configuration = join(directory, 'application.conf');
  try {
    await mkdir(root);
    await Promise.all([
      writeFile(unit, `[Service]\nExecStart=${wrapper}\n`),
      writeFile(wrapper, `#!/bin/sh\n. ${configuration}\nexec /bin/true\n`),
      writeFile(configuration, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
    ]);
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
      'retire-ollama-systemd-wrapper-source-test',
      script.pathname,
      root,
    ]);
    assert.match(
      stdout,
      new RegExp(`^${unit}\\|.*\\|${configuration}\\|`, 'm')
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('fails closed on a dynamic systemd wrapper source expression', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-wrapper-dynamic-source-'))
  );
  const root = join(directory, 'units');
  const unit = join(root, 'application.service');
  const wrapper = join(directory, 'application-wrapper');
  try {
    await mkdir(root);
    await Promise.all([
      writeFile(unit, `[Service]\nExecStart=${wrapper}\n`),
      writeFile(wrapper, '#!/bin/sh\n. "$APPLICATION_CONFIG"\n'),
    ]);
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
        'retire-ollama-systemd-wrapper-dynamic-source-test',
        script.pathname,
        root,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('fails closed when a Compose project directory is reachable only through a symlink', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-project-link-'))
  );
  const root = join(directory, 'projects');
  const release = join(directory, 'releases', 'application');
  try {
    await Promise.all([mkdir(root), mkdir(release, { recursive: true })]);
    await writeFile(
      join(release, 'compose.yaml'),
      'services:\n  app:\n    environment:\n      OLLAMA_HOST: http://127.0.0.1:11434\n'
    );
    await symlink(release, join(root, 'current'));
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
        'retire-ollama-compose-project-link-test',
        script.pathname,
        root,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
