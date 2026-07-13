import { execFile as execFileCallback } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFile = promisify(execFileCallback);
const moduleUrl = pathToFileURL(
  resolve(process.cwd(), 'tools/perf/postgres-baseline-delta.mjs')
).href;

describe('postgres baseline delta CLI module', () => {
  it('can be imported when Node does not provide a script argument', async () => {
    const { stderr } = await execFile(process.execPath, [
      '--input-type=module',
      '--eval',
      `await import(${JSON.stringify(moduleUrl)})`,
    ]);

    expect(stderr).toBe('');
  });
});
