#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPostgresBaselineDelta } from './postgres-baseline-delta-core.mjs';

export { createPostgresBaselineDelta };

function cliOptions(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('arguments must be --name value pairs');
    }
    options.set(key.slice(2), value);
  }
  return options;
}

async function run() {
  const options = cliOptions(process.argv.slice(2));
  for (const required of [
    'before',
    'after',
    'before-artifact',
    'after-artifact',
    'deployed-sha',
  ]) {
    if (!options.has(required)) throw new Error(`--${required} is required`);
  }
  const [beforeRaw, afterRaw, beforeArtifact, afterArtifact] =
    await Promise.all([
      readFile(options.get('before')),
      readFile(options.get('after')),
      readFile(options.get('before-artifact')),
      readFile(options.get('after-artifact')),
    ]);
  const result = createPostgresBaselineDelta({
    beforeRaw,
    afterRaw,
    beforeArtifact,
    afterArtifact,
    deployedSha: options.get('deployed-sha'),
  });
  const output = `${JSON.stringify(result, null, 2)}\n`;
  const outputPath = options.get('out');
  if (!outputPath) {
    process.stdout.write(output);
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, { flag: 'wx' });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
