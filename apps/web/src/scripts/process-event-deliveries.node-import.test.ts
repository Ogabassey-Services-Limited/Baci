import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('process-event-deliveries Node entrypoint', () => {
  it('loads under the VPS Node runtime without the Vercel-only server-only module', () => {
    const entrypoint = pathToFileURL(
      resolve(process.cwd(), 'src/scripts/process-event-deliveries.ts')
    ).href;

    expect(() =>
      execFileSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '--eval', `await import('${entrypoint}')`],
        { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' }
      )
    ).not.toThrow();
  });
});
