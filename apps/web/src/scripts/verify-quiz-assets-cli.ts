import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  verifyQuizAssets,
  type VerifyQuizAssetsOptions,
  writeQuizAssetManifest,
} from './verify-quiz-assets';

export function parseArgs(
  argv: readonly string[]
): VerifyQuizAssetsOptions & {
  generatedAt?: string;
  writeManifest?: boolean;
} {
  const options: VerifyQuizAssetsOptions & {
    generatedAt?: string;
    writeManifest?: boolean;
  } = {};

  for (const arg of argv) {
    if (arg === '--write-manifest') {
      options.writeManifest = true;
      continue;
    }
    if (arg.startsWith('--generated-at=')) {
      options.generatedAt = arg.slice('--generated-at='.length);
      continue;
    }
    if (arg.startsWith('--repo-root=')) {
      options.repoRoot = arg.slice('--repo-root='.length);
      continue;
    }
    if (arg.startsWith('--manifest=')) {
      options.manifestPath = arg.slice('--manifest='.length);
      continue;
    }
    throw new Error(`Unknown argument "${arg}"`);
  }

  return options;
}

export async function runVerifyQuizAssetsCli(
  argv = process.argv.slice(2)
): Promise<number> {
  const options = parseArgs(argv);
  if (options.writeManifest) {
    await writeQuizAssetManifest(options);
    console.log('Quiz asset manifest regenerated');
    return 0;
  }

  const result = await verifyQuizAssets(options);

  if (result.ok) {
    console.log('Quiz asset verification passed');
    return 0;
  }

  for (const error of result.errors) {
    console.error(error);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVerifyQuizAssetsCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
