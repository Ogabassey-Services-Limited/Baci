import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('binds a stopped generic unit to its endpoint-bearing StandardInput file', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-standard-input-'))
  );
  const root = join(directory, 'units');
  const unit = join(root, 'application.service');
  const input = join(directory, 'application.conf');
  try {
    await mkdir(root);
    await Promise.all([
      writeFile(
        unit,
        `[Service]\nStandardInput=file:${input}\nExecStart=/bin/true\n`
      ),
      writeFile(input, 'upstream=http://127.0.0.1:11434\n'),
    ]);

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
      'retire-ollama-systemd-standard-input-test',
      script.pathname,
      root,
    ]);

    assert.match(stdout, new RegExp(`^${unit}\\|.*\\|${input}\\|`, 'm'));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds StandardInput inside a stopped unit RootDirectory', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-rooted-standard-input-'))
  );
  const units = join(directory, 'units');
  const executionRoot = join(directory, 'execution-root');
  const unit = join(units, 'application.service');
  const hostInput = join(directory, 'application.conf');
  const rootedInput = `${executionRoot}${hostInput}`;
  const worker = join(executionRoot, 'usr/bin/application-worker');
  try {
    await Promise.all([
      mkdir(units),
      mkdir(dirname(rootedInput), { recursive: true }),
      mkdir(dirname(worker), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        unit,
        `[Service]\nRootDirectory=${executionRoot}\nStandardInput=file:${hostInput}\nExecStart=/usr/bin/application-worker\n`
      ),
      writeFile(hostInput, 'upstream=http://127.0.0.1:8080\n'),
      writeFile(rootedInput, 'upstream=http://127.0.0.1:11434\n'),
      writeFile(worker, '#!/bin/sh\nexit 0\n', { mode: 0o755 }),
    ]);

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
      'retire-ollama-systemd-rooted-standard-input-test',
      script.pathname,
      units,
    ]);

    assert.match(stdout, new RegExp(`^${unit}\\|.*\\|${rootedInput}\\|`, 'm'));
    assert.doesNotMatch(stdout, new RegExp(`\\|${hostInput}\\|`));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('fails closed for a stopped unit StandardInput inside RootImage', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-image-standard-input-'))
  );
  const units = join(directory, 'units');
  const unit = join(units, 'application.service');
  const image = join(directory, 'root.raw');
  const input = join(directory, 'application.conf');
  try {
    await mkdir(units);
    await Promise.all([
      writeFile(
        unit,
        `[Service]\nRootImage=${image}\nStandardInput=file:${input}\nExecStart=/bin/true\n`
      ),
      writeFile(image, 'opaque-image\n'),
      writeFile(input, 'upstream=http://127.0.0.1:11434\n'),
    ]);

    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_static_standard_inputs "$2"`,
        'retire-ollama-systemd-image-standard-input-test',
        script.pathname,
        unit,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('accepts every valid non-file StandardInput mode with RootImage', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-image-non-file-input-'))
  );
  const image = join(directory, 'root.raw');
  try {
    await writeFile(image, 'opaque-image\n');
    await Promise.all(
      [
        'null',
        'tty',
        'tty-force',
        'tty-fail',
        'socket',
        'data',
        'fd',
        'fd:application-input',
      ].map((mode, index) =>
        writeFile(
          join(directory, `application-${index}.service`),
          `[Service]\nRootImage=${image}\nStandardInput=${mode}\nExecStart=/bin/true\n`
        )
      )
    );

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; for definition in "$2"/*.service; do systemd_static_standard_inputs "$definition" || exit; done`,
      'retire-ollama-systemd-image-non-file-input-test',
      script.pathname,
      directory,
    ]);

    assert.equal(stdout, '');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('accepts valid non-file StandardInput modes in stopped units', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-non-file-standard-input-'))
  );
  const units = join(directory, 'units');
  try {
    await mkdir(units);
    await Promise.all(
      ['data', 'fd', 'fd:application-input'].map((mode, index) =>
        writeFile(
          join(units, `application-${index}.service`),
          `[Service]\nStandardInput=${mode}\nExecStart=/bin/true\n`
        )
      )
    );

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
      'retire-ollama-systemd-non-file-standard-input-test',
      script.pathname,
      units,
    ]);

    assert.equal(stdout, '');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('accepts runtime null StandardInput without querying a nonexistent file property', async () => {
  const { stdout } = await execFileAsync('sh', [
    '-c',
    `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_inventory() { printf 'application.service loaded inactive dead fixture\\n' >"$2"; }; systemd_manager_call() { case " $* " in *' --property=StandardInput '*) :;; *) return 64;; esac; case " $* " in *StandardInputFile*) return 64;; esac; printf 'RootDirectory=\\nRootImage=\\nEnvironment=\\nEnvironmentFiles=\\nLoadCredential=\\nLoadCredentialEncrypted=\\nStandardInput=null\\nExecStart={}\\n'; }; scan_systemd_runtime_consumers system`,
    'retire-ollama-systemd-runtime-null-input-test',
    script.pathname,
  ]);

  assert.equal(stdout, '');
});

test('accepts valid non-file StandardInput modes from runtime units', async () => {
  const { stdout } = await execFileAsync('sh', [
    '-c',
    `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_inventory() { printf 'data.service loaded inactive dead fixture\\nfd.service loaded inactive dead fixture\\nnamed.service loaded inactive dead fixture\\n' >"$2"; }; systemd_manager_call() { case " $* " in *' --property=StandardInput '*) :;; *) return 64;; esac; for unit do :; done; case "$unit" in data.service) mode=data;; fd.service) mode=fd;; named.service) mode=fd:application-input;; *) return 64;; esac; printf 'RootDirectory=\\nRootImage=\\nEnvironment=\\nEnvironmentFiles=\\nLoadCredential=\\nLoadCredentialEncrypted=\\nStandardInput=%s\\nExecStart={}\\n' "$mode"; }; scan_systemd_runtime_consumers system`,
    'retire-ollama-systemd-runtime-non-file-input-test',
    script.pathname,
  ]);

  assert.equal(stdout, '');
});

test('fails closed for runtime file StandardInput whose target is not readable', async () => {
  await assert.rejects(
    execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_inventory() { printf 'application.service loaded inactive dead fixture\\n' >"$2"; }; systemd_manager_call() { case " $* " in *' --property=StandardInput '*) :;; *) return 64;; esac; case " $* " in *StandardInputFile*) return 64;; esac; printf 'RootDirectory=\\nRootImage=\\nEnvironment=\\nEnvironmentFiles=\\nLoadCredential=\\nLoadCredentialEncrypted=\\nStandardInput=file\\nExecStart={}\\n'; }; scan_systemd_runtime_consumers system`,
      'retire-ollama-systemd-runtime-file-input-test',
      script.pathname,
    ]),
    (error) => error.code === 2
  );
});

test('fails closed for a dynamic StandardInput file path', async () => {
  await assert.rejects(
    execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_standard_input_target / 'file:/etc/$CONFIG'`,
      'retire-ollama-systemd-dynamic-standard-input-test',
      script.pathname,
    ]),
    (error) => error.code === 2
  );
});
