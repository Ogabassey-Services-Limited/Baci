import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:0:0:600\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

function scanPassEnvironment(selection, environment, changed = '') {
  return execFileAsync('sh', [
    '-c',
    `${prelude}selection=$2; environment=$3; changed=$4; calls=0; . "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_inventory() { printf 'application.service loaded inactive dead fixture\\n' >"$2"; }; systemd_manager_call() { manager=$1; shift; case "$1" in show-environment) calls=$((calls + 1)); if [ "$calls" -eq 2 ] && [ -n "$changed" ]; then printf '%s\\n' "$changed"; else printf '%s\\n' "$environment"; fi;; show) printf 'RootDirectory=\\nRootImage=\\nWorkingDirectory=\\nEnvironment=\\nEnvironmentFiles=\\nPassEnvironment=%s\\nLoadCredential=\\nLoadCredentialEncrypted=\\nStandardInput=null\\nExecStart={ path=/bin/true ; argv[]=/bin/true ; }\\n' "$selection";; *) return 2;; esac; }; scan_systemd_runtime_consumers system`,
    'retire-ollama-systemd-pass-environment-test',
    script.pathname,
    selection,
    environment,
    changed,
  ]);
}

test('binds a selected manager value passed to a stopped systemd unit', async () => {
  const { stdout } = await scanPassEnvironment(
    'UPSTREAM',
    'UPSTREAM=http://127.0.0.1:11434\nIGNORED=http://127.0.0.1:8080'
  );
  assert.match(
    stdout,
    /^application\.service:manager-environment\|[a-f0-9]{64}\|[a-f0-9]{64}$/m
  );
  assert.doesNotMatch(stdout, /11434|UPSTREAM/);
});

test('fails closed on an unsafe PassEnvironment selection', async () => {
  await assert.rejects(
    scanPassEnvironment('UPSTREAM;OTHER', 'UPSTREAM=http://127.0.0.1:11434'),
    (error) => error.code === 2
  );
});

test('fails closed when the manager environment changes during capture', async () => {
  await assert.rejects(
    scanPassEnvironment(
      'UPSTREAM',
      'UPSTREAM=http://127.0.0.1:11434',
      'UPSTREAM=http://127.0.0.1:8080'
    ),
    (error) => error.code === 2
  );
});

test('fails closed on malformed manager environment output', async () => {
  await assert.rejects(
    scanPassEnvironment('UPSTREAM', 'UPSTREAM=http://127.0.0.1:11434\nBROKEN'),
    (error) => error.code === 2
  );
});
