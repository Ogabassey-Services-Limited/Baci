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

test('fails closed before accepting a flow-style Compose services map', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-flow-services-'))
  );
  const marker = join(directory, 'docker-called');
  try {
    await writeFile(
      join(directory, 'compose.yaml'),
      'services: { app: { image: hidden-image } }\n'
    );
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${prelude}docker() { : >"$3"; printf 'sha256:${'a'.repeat(64)} {"Env":["ENDPOINT=http://127.0.0.1:11434"]}\\n'; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
        'retire-ollama-compose-flow-services-test',
        script.pathname,
        directory,
        marker,
      ]),
      (error) => error.code === 2
    );
    await assert.rejects(realpath(marker));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('fails closed before accepting a quoted Compose services key', async () => {
  await assert.rejects(
    execFileAsync('sh', [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; printf '"services":\\n  app:\\n    image: hidden-image\\n' | compose_image_refs /dev/stdin`,
      'retire-ollama-compose-quoted-services-test',
      script.pathname,
    ]),
    (error) => error.code === 2
  );
});

test('binds a static systemd BindReadOnlyPaths source', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-static-bind-path-'))
  );
  const units = join(directory, 'units');
  const source = join(directory, 'application.conf');
  try {
    await mkdir(units);
    await Promise.all([
      writeFile(source, 'endpoint=http://127.0.0.1:11434\n'),
      writeFile(
        join(units, 'application.service'),
        `[Service]\nBindReadOnlyPaths=${source}:/etc/application.conf\nExecStart=/bin/true\n`
      ),
    ]);
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
      'retire-ollama-static-bind-path-test',
      script.pathname,
      units,
    ]);
    assert.match(stdout, new RegExp(`\\|${source}\\|`));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds a runtime systemd BindPaths source', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-runtime-bind-path-'))
  );
  const source = join(directory, 'application.conf');
  try {
    await writeFile(source, 'endpoint=http://127.0.0.1:11434\n');
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}source=$2; . "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_inventory() { printf 'application.service loaded inactive dead fixture\\n' >"$2"; }; systemd_manager_call() { printf 'RootDirectory=\\nRootImage=\\nWorkingDirectory=\\nEnvironment=\\nEnvironmentFiles=\\nPassEnvironment=\\nLoadCredential=\\nLoadCredentialEncrypted=\\nStandardInput=null\\nBindPaths=%s:/etc/application.conf\\nBindReadOnlyPaths=\\nExecStart={}\\n' "$source"; }; scan_systemd_runtime_consumers system`,
      'retire-ollama-runtime-bind-path-test',
      script.pathname,
      source,
    ]);
    assert.match(
      stdout,
      new RegExp(`^application\\.service:${source}\\|`, 'm')
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
