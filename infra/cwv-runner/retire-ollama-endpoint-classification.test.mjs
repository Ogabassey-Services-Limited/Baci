import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('classifies only an exact loopback Ollama authority as loopback', async () => {
  const { stdout } = await execFileAsync('sh', [
    '-c',
    '. "$1"; shift; for endpoint do classify_endpoint "$endpoint"; printf "\\n"; done',
    'retire-ollama-endpoint-classification-test',
    script.pathname,
    'disabled',
    'http://127.0.0.1:11434',
    'http://localhost:11434/api',
    'https://api.example.com/v1',
    'http://127.attacker.example:11434',
    'http://127.0.0.1:11434@api.example.com',
    'https://127.0.0.1:11434',
  ]);

  assert.deepEqual(stdout.trim().split('\n'), [
    'disabled',
    'ollama-loopback',
    'ollama-loopback',
    'external-provider',
    'unknown',
    'unknown',
    'unknown',
  ]);
});
