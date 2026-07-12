import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tsxCliPath = require.resolve('tsx/cli');
const toolsDirectory = dirname(fileURLToPath(import.meta.url));

describe('SEO CLI entrypoints', () => {
  for (const entrypoint of [
    'run-pagespeed.cli.ts',
    'run-search-console-readiness.cli.ts',
  ]) {
    it(`loads ${entrypoint} through the same tsx CJS transform used by package scripts`, () => {
      const entrypointUrl = pathToFileURL(
        join(toolsDirectory, entrypoint)
      ).href;
      const importExpression = `import(${JSON.stringify(
        entrypointUrl
      )}).catch((error) => { console.error(error); process.exitCode = 1; })`;

      expect(() =>
        execFileSync(process.execPath, [tsxCliPath, '-e', importExpression], {
          cwd: toolsDirectory,
          env: process.env,
          stdio: 'pipe',
          timeout: 10_000,
        })
      ).not.toThrow();
    });
  }
});
