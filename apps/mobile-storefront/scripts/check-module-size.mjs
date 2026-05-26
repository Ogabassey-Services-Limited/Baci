import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');

if (!process.argv.includes('--project-root')) {
  process.argv.splice(2, 0, '--project-root', projectRoot);
}

await import('../../../packages/shared/scripts/check-module-size.mjs');
