import { lstatSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './canonical-json.mjs';
import {
  createRunnerRuntimeBundle,
  writeRunnerRuntimeBundle,
} from './runner-runtime-manifest-producer.mjs';

const usage =
  'usage: node runner-runtime-manifest-producer-cli.mjs --write --archive <image.tar> --image-receipt <image-receipt.json> --source-manifest <source-manifest.json> --source-manifest-sha256 <sha256> --output-directory <owner-private-dir> --projection-directory <owner-private-dir>\n';
const fail = () => {
  throw new TypeError('runner runtime producer CLI refused');
};
const exactFlags = [
  '--archive',
  '--image-receipt',
  '--output-directory',
  '--projection-directory',
  '--source-manifest',
  '--source-manifest-sha256',
];

function flags(args) {
  if (args[0] !== '--write' || args.length !== 13) fail();
  const values = {};
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!exactFlags.includes(flag) || !value || values[flag]) fail();
    values[flag] = value;
  }
  if (Object.keys(values).length !== exactFlags.length) fail();
  return values;
}

function receipt(path) {
  const details = lstatSync(path);
  if (
    !details.isFile() ||
    details.isSymbolicLink() ||
    details.uid !== process.getuid() ||
    details.nlink !== 1 ||
    (details.mode & 0o022) !== 0
  )
    fail();
  const bytes = readFileSync(path);
  try {
    const value = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    );
    if (canonicalJson(value) !== bytes.toString('utf8')) fail();
    return value;
  } catch {
    fail();
  }
}

export async function runRunnerRuntimeProducerCli(
  args = process.argv.slice(2)
) {
  const values = flags(args);
  const bundle = createRunnerRuntimeBundle({
    archive: values['--archive'],
    imageReceipt: receipt(values['--image-receipt']),
    sourceManifestPath: values['--source-manifest'],
    sourceManifestSha256: values['--source-manifest-sha256'],
  });
  return await writeRunnerRuntimeBundle(
    values['--output-directory'],
    values['--projection-directory'],
    bundle
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.stdout.write(
      `${canonicalJson(await runRunnerRuntimeProducerCli())}\n`
    );
  } catch {
    process.stderr.write(usage);
    process.exitCode = 1;
  }
}
