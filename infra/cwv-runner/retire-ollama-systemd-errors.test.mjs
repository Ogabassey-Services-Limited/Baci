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
  'stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('fails closed when runtime EnvironmentFile content matching errors', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-runtime-match-error-'))
  );
  const environment = join(directory, 'runtime.env');
  try {
    await writeFile(environment, 'UNRELATED=1\n');
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; consumer_matches() { return 2; }; scan_systemd_runtime_environment_files transient "$2 (ignore_errors=no)"`,
        'retire-ollama-runtime-match-error-test',
        script.pathname,
        environment,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('propagates a failed system runtime inventory without a user manager', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-runtime-inventory-error-'))
  );
  try {
    await mkdir(directory, { recursive: true });
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${prelude}getent() { return 1; }; systemctl() { return 2; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; if scan_systemd_consumers; then exit 0; else exit $?; fi`,
        'retire-ollama-system-runtime-error-test',
        script.pathname,
        directory,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
