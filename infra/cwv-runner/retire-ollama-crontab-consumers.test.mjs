import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('classifies uppercase Ollama crontab variables without changing evidence bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-ollama-crontab-'));
  const cron = join(directory, 'cron');
  const line = 'OLLAMA_HOST=http://127.0.0.1:8080';
  try {
    await writeFile(
      cron,
      `${line}\n0 * * * * /usr/bin/ollama serve\n0 * * * * /usr/bin/other\n`
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      '. "$1"; init_temp_root; trap cleanup_temp EXIT; deps="[]"; consumer_counts="[]"; consumer_evidence="[]"; record_consumers current-crontab "$2" cron; printf "%s\\n%s\\n" "$consumer_counts" "$consumer_evidence"',
      'retire-ollama-crontab-consumers-test',
      script.pathname,
      cron,
    ]);
    const [counts, evidence] = stdout.trim().split('\n').map(JSON.parse);
    assert.deepEqual(counts, [{ surface: 'current-crontab', matchCount: 1 }]);
    assert.deepEqual(evidence, [
      {
        surface: 'current-crontab',
        classifiedPathSha256: createHash('sha256').update(line).digest('hex'),
      },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
