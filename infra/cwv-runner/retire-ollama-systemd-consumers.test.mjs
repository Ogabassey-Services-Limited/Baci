import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('finds another unit whose EnvironmentFile consumes Ollama', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-systemd-consumer-'));
  const units = join(directory, 'units');
  const environment = join(directory, 'application.env');
  try {
    await mkdir(units);
    await writeFile(environment, 'OLLAMA_HOST=http://127.0.0.1:11434\n');
    await writeFile(
      join(units, 'application.service'),
      `[Service]\nEnvironmentFile=${environment}\n`
    );
    await writeFile(
      join(units, 'ollama.service'),
      `[Service]\nEnvironmentFile=${environment}\n`
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      '. "$1"; SCRIPT_DIR=$(dirname "$1"); . "$SCRIPT_DIR/retire-ollama-recovery.sh"; SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; RECOVERY_RECORDS="[]"; deps="[]"; recovery_record_path() { :; }; scan_systemd_consumers; printf "deps=%s\\n" "$deps"',
      'retire-ollama-systemd-consumers-test',
      script.pathname,
      units,
    ]);
    const [consumer, serializedDependencies] = stdout.trim().split('\n');
    assert.equal(
      consumer,
      `${join(units, 'application.service')}:${environment}`
    );
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
