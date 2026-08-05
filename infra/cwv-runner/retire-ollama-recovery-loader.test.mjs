import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('fails closed with a controlled status when the recovery helper is absent', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-ollama-recovery-missing-')
  );
  try {
    const copied = join(directory, 'retire-ollama.sh');
    await writeFile(copied, await readFile(script));
    await chmod(copied, 0o755);
    await assert.rejects(
      execFileAsync('sh', [copied, '--recovery-scan'], { env: process.env }),
      (error) =>
        error.code === 78 && /recovery helper missing/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
