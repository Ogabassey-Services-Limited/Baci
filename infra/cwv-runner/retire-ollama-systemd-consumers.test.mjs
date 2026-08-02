import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

function assertFingerprint(fields, offset, expectedPath) {
  assert.equal(fields[offset], expectedPath);
  assert.match(fields[offset + 1], /^[0-9a-f]{64}$/);
  assert.match(fields[offset + 2], /^[0-9a-f]{64}$/);
}

test('finds another unit whose EnvironmentFile consumes Ollama', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-consumer-'))
  );
  const units = join(directory, 'units');
  const environment = join(directory, 'application config.env');
  try {
    await mkdir(units);
    await writeFile(environment, 'OLLAMA_HOST=http://127.0.0.1:11434\n');
    await writeFile(
      join(units, 'application.service'),
      `[Service]\nEnvironmentFile="${environment}"\n`
    );
    await writeFile(
      join(units, 'ollama.service'),
      `[Service]\nEnvironmentFile="${environment}"\n`
    );
    await writeFile(
      join(units, 'uppercase.service'),
      '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:8080\n'
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      'systemctl() { :; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); . "$SCRIPT_DIR/retire-ollama-recovery.sh"; SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; RECOVERY_RECORDS="[]"; deps="[]"; recovery_record_path() { :; }; scan_systemd_consumers; printf "deps=%s\\n" "$deps"',
      'retire-ollama-systemd-consumers-test',
      script.pathname,
      units,
    ]);
    const [direct, consumer, serializedDependencies] = stdout
      .trim()
      .split('\n');
    assertFingerprint(direct.split('|'), 0, join(units, 'uppercase.service'));
    const consumerFields = consumer.split('|');
    assertFingerprint(consumerFields, 0, join(units, 'application.service'));
    assertFingerprint(consumerFields, 3, environment);
    assert.deepEqual(JSON.parse(serializedDependencies.slice('deps='.length)), [
      {
        'key-name': 'environment:OLLAMA_HOST',
        'endpoint-class': 'ollama-loopback',
        'normalized-value-sha256': createHash('sha256')
          .update('http://127.0.0.1:11434')
          .digest('hex'),
        'source-path-sha256': createHash('sha256')
          .update(environment)
          .digest('hex'),
        disposition: 'review',
      },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('skips a quoted optional missing EnvironmentFile and rejects malformed quotes', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-consumer-quotes-'))
  );
  const units = join(directory, 'units');
  try {
    await mkdir(units);
    await writeFile(
      join(units, 'optional.service'),
      '[Service]\nEnvironmentFile=-"/missing application config.env"\n'
    );
    await execFileAsync('sh', [
      '-c',
      'systemctl() { :; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers',
      'retire-ollama-systemd-consumers-optional-test',
      script.pathname,
      units,
    ]);
    await writeFile(
      join(units, 'malformed.service'),
      '[Service]\nEnvironmentFile="/unterminated path\n'
    );
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        'systemctl() { :; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers',
        'retire-ollama-systemd-consumers-malformed-test',
        script.pathname,
        units,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('finds a loaded transient unit whose runtime environment consumes Ollama', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-systemd-runtime-'));
  try {
    const property = 'Environment=OLLAMA_HOST=http://127.0.0.1:11434';
    const { stdout } = await execFileAsync('sh', [
      '-c',
      'systemctl() { case "$1" in list-units) printf "transient.service loaded active running transient\\n";; show) printf "Environment=OLLAMA_HOST=http://127.0.0.1:11434\\nEnvironmentFiles=\\nExecStart={}\\n";; *) return 64;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers',
      'retire-ollama-systemd-runtime-test',
      script.pathname,
      directory,
    ]);
    assert.equal(
      stdout.trim(),
      `transient.service:${createHash('sha256').update(property).digest('hex')}`
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
