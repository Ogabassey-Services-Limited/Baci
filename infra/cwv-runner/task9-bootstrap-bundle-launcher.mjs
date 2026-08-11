import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DIGEST = /^[a-f0-9]{64}$/;
const fail = () => { throw new TypeError('invalid Task 9 composer'); };

export async function runTask9BootstrapBundleLauncher({ composerPath, composerSha256, argv, cwd }) {
  if (typeof composerPath !== 'string' || typeof cwd !== 'string' || !Array.isArray(argv) || !DIGEST.test(composerSha256 ?? '')) fail();
  const composer = realpathSync(composerPath);
  if (realpathSync(cwd) !== realpathSync(new URL('../..', import.meta.url))) fail();
  const bytes = readFileSync(composer);
  if (createHash('sha256').update(bytes).digest('hex') !== composerSha256) fail();
  const module = await import(pathToFileURL(composer).href);
  if (typeof module.runTask9BootstrapBundleCli !== 'function') fail();
  return module.runTask9BootstrapBundleCli(argv);
}
