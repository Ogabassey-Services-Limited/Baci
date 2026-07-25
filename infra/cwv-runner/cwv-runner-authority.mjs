// biome-ignore-all format: sealed authority bytes are mirrored into the runtime image.
import { pathToFileURL } from 'node:url';

export * from './cwv-runner-authority-core.mjs';

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const { runAuthorityCli } = await import('./cwv-runner-authority-runtime.mjs');
  runAuthorityCli({ args: process.argv.slice(2) }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'authority failure'}\n`);
    process.exitCode = 1;
  });
}
