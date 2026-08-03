import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('exempts only the reviewed service process when argv is duplicated', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-service-process-'));
  const processes = join(directory, 'processes');
  try {
    await writeFile(
      processes,
      '41 1 ollama /usr/bin/ollama serve\n42 1 ollama /usr/bin/ollama serve\n'
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `. "$1"; init_temp_root; trap cleanup_temp EXIT; APPROVED_OLLAMA_PID=41; APPROVED_OLLAMA_PROCESS_IDENTITY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; deps='[]'; consumer_counts='[]'; consumer_evidence='[]'; record_consumers running-processes "$2"; printf '%s\n' "$consumer_counts"`,
      'retire-ollama-service-process-binding-test',
      script.pathname,
      processes,
    ]);
    assert.deepEqual(JSON.parse(stdout), [
      { surface: 'running-processes', matchCount: 1 },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
