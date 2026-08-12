import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIGEST = /^[a-f0-9]{64}$/;
const fail = () => { throw new TypeError('invalid Task 9 composer'); };
const EXPECTED = Object.freeze({
  'canonical-json.mjs': 'b65fea46e65c67b8f1e85da9c851e2170536f05b236445de5d481bb9ec97124c',
  'git-ref-validator.mjs': '3dc5632a1f0f3862aa7365b612aa6cd784c0ece25168ec8bf8a08eac30de78c6',
  'source-archive.mjs': 'c0db315f3f86cd82f396531a30fe074a0b35824aa6b2e9c76e7ce07f720d1842',
  'source-manifest-git.mjs': '309da5cba3d610b4a8bdaa42b2c1ab7f118485666975e45cb480b034afb089e6',
  'source-manifest-objects.mjs': 'c4085ab23f7090c2da256dd2f66f7ca0bd28afb5b00458527f1c98c504f23d81',
  'source-manifest-tree.mjs': 'e799edad446a6ea187d81db1f769f9b5e8ff356f0e04ff47e92f854939b4b9ea',
  'source-manifest.mjs': '7662a7e469fc57b936999c9eeba2a0dbf75f41d33861cffa5467c3439329fab4',
  'task9-authority-receipt.mjs': 'd6671151690b665fb04ec314ce84ec19909ac5e557716f294134130c5a95e85b',
  'task9-bootstrap-bundle-cli.mjs': '81937ef01a354818d2dc2e4bd5645b23d51103626ad145df5d84e6070f848aae',
  'task9-bootstrap-bundle.mjs': '95b1058258c36e46d93564d83b1a9fe521f1feb45688b705e888ab2e3bb96b6e',
  'task9-bootstrap-identity.mjs': '5483014145643f49380928e8973627b5401cc6f42771ce1a41f7aae7f56bad75',
  'task9-bootstrap-provenance.mjs': 'ed6c3b124eecb7980d699e99335102ca53b155300ec21bfdf89fcc612634db8c',
  'task9-bootstrap.mjs': '332b6749e41a94a71be3c32c3e8c3de6388bba14a180dbd676b9ffde81e9d504',
  'task9-fsync-directory.mjs': '8a2b37a92184b89f0f16388e1abe5a0ba1940c39f8b914fb55d382c4bc810b2b',
  'task9-held-checkout.mjs': '2597914a9fcf3c83628aa3175c689ca6e37b1b4abfc81ea2c019bf0ddfd941a1',
  'task9-held-file.mjs': 'e32c584bc708ef4b0860be31ad5f07795d90e718908e3547a297a12da86b4a2e',
  'task9-node-archive.mjs': 'd12b28d1f84fe2247c527cf9ec94e98069a575d54048f8ce2b2a1ebcf5d17a31',
  'task9-output-directory.mjs': '65d5846c9dae2ada24daa3c3fed082008e15664f2fef9cc2d9e17c5f66c5f827',
  'task9-pr-metadata.mjs': '923542fdc0af37e667c981027f9e28e867bcdae6144020452a796948b5d91f19',
  'task9-published-files.mjs': '6b99c7292def0551ff16b81afa46500bc1b662d6f5593125750d1db8aa42ca59',
});

function immutableModule(name, root, cache = new Map()) {
  if (cache.has(name)) return cache.get(name);
  const expected = EXPECTED[name];
  if (!expected) fail();
  let source = readFileSync(join(root, name), 'utf8');
  if (createHash('sha256').update(source).digest('hex') !== expected) fail();
  source = source.replaceAll('fileURLToPath(import.meta.url)', JSON.stringify(join(root, name)));
  const imports = [...source.matchAll(/from\s+(['"])(\.\/[^'"]+)\1/g)];
  for (const match of imports) {
    const child = match[2].slice(2);
    source = source.replace(match[0], `from ${match[1]}${immutableModule(child, root, cache)}${match[1]}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  cache.set(name, url);
  return url;
}

export async function runTask9BootstrapBundleLauncher({ composerPath, composerSha256, argv, cwd }) {
  if (typeof composerPath !== 'string' || typeof cwd !== 'string' || !Array.isArray(argv) || !DIGEST.test(composerSha256 ?? '')) fail();
  const composer = realpathSync(composerPath);
  if (realpathSync(cwd) !== realpathSync(new URL('../..', import.meta.url))) fail();
  if (composer !== join(dirname(fileURLToPath(import.meta.url)), 'task9-bootstrap-bundle-cli.mjs')) fail();
  const bytes = readFileSync(composer);
  if (createHash('sha256').update(bytes).digest('hex') !== composerSha256) fail();
  try {
    const module = await import(immutableModule('task9-bootstrap-bundle-cli.mjs', dirname(composer)));
    if (typeof module.runTask9BootstrapBundleCli !== 'function') fail();
    return module.runTask9BootstrapBundleCli(argv);
  } catch (error) {
    if (error instanceof TypeError && error.message === 'invalid Task 9 bundle invocation') throw error;
    throw error;
  }
}

try {
  if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    const [composerPath, composerSha256, cwd, ...argv] = process.argv.slice(2);
    const output = await runTask9BootstrapBundleLauncher({ composerPath, composerSha256, cwd, argv });
    process.stdout.write(`${output}\n`);
  }
} catch {
  process.stderr.write('task9-bootstrap-bundle-launcher refused\n');
  process.exitCode = 1;
}
