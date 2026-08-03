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

test('accepts runtime null StandardInput without querying a nonexistent file property', async () => {
  const { stdout } = await execFileAsync('sh', [
    '-c',
    `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_inventory() { printf 'application.service loaded inactive dead fixture\\n' >"$2"; }; systemd_manager_call() { case " $* " in *' --property=StandardInput '*) :;; *) return 64;; esac; case " $* " in *StandardInputFile*) return 64;; esac; printf 'RootDirectory=\\nRootImage=\\nEnvironment=\\nEnvironmentFiles=\\nLoadCredential=\\nLoadCredentialEncrypted=\\nStandardInput=null\\nExecStart={}\\n'; }; scan_systemd_runtime_consumers system`,
    'retire-ollama-systemd-runtime-null-input-test',
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
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_standard_input_target 'file:/etc/$CONFIG'`,
      'retire-ollama-systemd-dynamic-standard-input-test',
      script.pathname,
    ]),
    (error) => error.code === 2
  );
});
