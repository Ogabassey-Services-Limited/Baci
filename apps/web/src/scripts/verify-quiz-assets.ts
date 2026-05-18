import { createHash } from 'node:crypto';
import { access, readFile, readdir, realpath, writeFile, type Dirent } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  normalizeQuizAssetManifest,
  QUIZ_ASSET_ROOT,
  type QuizAssetGeneratedManifest,
  type QuizAssetVerificationEntry,
} from './verify-quiz-assets-manifest';
import { verifyNoReferenceImports } from './verify-quiz-source-references';
export type { QuizAssetManifest } from './verify-quiz-assets-manifest';

export type VerifyQuizAssetsOptions = {
  repoRoot?: string;
  manifestPath?: string;
};

export type GenerateQuizAssetManifestOptions = {
  generatedAt?: string;
  repoRoot?: string;
};

export type VerifyQuizAssetsResult = {
  ok: boolean;
  errors: string[];
};

const DEFAULT_MANIFEST_PATH =
  'apps/mobile-storefront/assets/quiz/manifest.json';
const QUIZ_ASSET_MANIFEST_FILENAME = 'manifest.json';
const MAX_QUIZ_ASSET_WALK_DEPTH = 100;
function resolveRelativePath(root: string, relativePath: string): string | null {
  if (path.isAbsolute(relativePath)) return null;

  const resolved = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root);
  if (
    resolved !== normalizedRoot &&
    !resolved.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    return null;
  }

  return resolved;
}

function toRepoPath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveRepoRoot(startPath: string): Promise<string> {
  let current = path.resolve(startPath);
  const fallbackRoot = current;
  const seenRealpaths = new Set<string>();

  while (true) {
    const realCurrent = await realpath(current).catch(() => current);
    if (seenRealpaths.has(realCurrent)) {
      return fallbackRoot;
    }
    seenRealpaths.add(realCurrent);

    if (
      (await pathExists(path.join(current, 'pnpm-workspace.yaml'))) ||
      (await pathExists(path.join(current, QUIZ_ASSET_ROOT)))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return fallbackRoot;
    }
    current = parent;
  }
}

export async function computeSha256(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

async function walkQuizAssetFiles(
  directory: string,
  visitFile: (filePath: string) => Promise<void>,
  depth = 0
) {
  if (depth > MAX_QUIZ_ASSET_WALK_DEPTH) {
    throw new Error(
      `Quiz asset walk exceeded ${MAX_QUIZ_ASSET_WALK_DEPTH} levels`
    );
  }

  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkQuizAssetFiles(entryPath, visitFile, depth + 1);
      continue;
    }

    if (entry.isFile() && entry.name !== QUIZ_ASSET_MANIFEST_FILENAME) {
      await visitFile(entryPath);
    }
  }
}

export async function generateQuizAssetManifest(
  options: GenerateQuizAssetManifestOptions = {}
): Promise<QuizAssetGeneratedManifest> {
  const repoRoot = await resolveRepoRoot(options.repoRoot ?? process.cwd());
  const assetRoot = path.join(repoRoot, QUIZ_ASSET_ROOT);
  const assets: QuizAssetGeneratedManifest['assets'] = [];

  await walkQuizAssetFiles(assetRoot, async (filePath) => {
    assets.push({
      repoPath: toRepoPath(repoRoot, filePath),
      sha256: await computeSha256(filePath),
    });
  });
  assets.sort((left, right) => left.repoPath.localeCompare(right.repoPath));

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    assets,
  };
}

export async function writeQuizAssetManifest(
  options: GenerateQuizAssetManifestOptions & { manifestPath?: string } = {}
) {
  const repoRoot = await resolveRepoRoot(options.repoRoot ?? process.cwd());
  const manifestPath =
    resolveRelativePath(
      repoRoot,
      options.manifestPath ?? DEFAULT_MANIFEST_PATH
    ) ?? path.resolve(repoRoot, DEFAULT_MANIFEST_PATH);
  const manifest = await generateQuizAssetManifest({
    generatedAt: options.generatedAt,
    repoRoot,
  });

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        ...manifest,
        note: 'Build-time asset verification manifest',
      },
      null,
      2
    )}\n`
  );
}

async function readManifest(
  manifestPath: string,
  errors: string[]
): Promise<QuizAssetVerificationEntry[] | null> {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
    return normalizeQuizAssetManifest(parsed, errors);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Unable to read quiz asset manifest: ${message}`);
    return null;
  }
}

async function verifyManifestFiles(
  repoRoot: string,
  manifestEntries: QuizAssetVerificationEntry[],
  errors: string[]
) {
  for (const file of manifestEntries) {
    const assetRelativePath = path.join(QUIZ_ASSET_ROOT, file.path);
    const assetPath = resolveRelativePath(repoRoot, assetRelativePath);
    if (!assetPath) {
      errors.push(`Invalid quiz asset path: ${file.path}`);
      continue;
    }

    if (!(await pathExists(assetPath))) {
      errors.push(`Missing quiz asset ${assetRelativePath}`);
      continue;
    }

    const actualSha256 = await computeSha256(assetPath);
    if (actualSha256 !== file.sha256) {
      errors.push(`Checksum mismatch for ${assetRelativePath}`);
    }
  }
}

async function verifyManifestCompleteness(
  repoRoot: string,
  manifestEntries: QuizAssetVerificationEntry[],
  errors: string[]
) {
  const generatedManifest = await generateQuizAssetManifest({ repoRoot });
  const manifestRepoPaths = new Set(
    manifestEntries.map((entry) =>
      path.join(QUIZ_ASSET_ROOT, entry.path).split(path.sep).join('/')
    )
  );

  for (const asset of generatedManifest.assets) {
    if (!manifestRepoPaths.has(asset.repoPath)) {
      errors.push(`Missing quiz asset manifest entry for ${asset.repoPath}`);
    }
  }
}

export async function verifyQuizAssets(
  options: VerifyQuizAssetsOptions = {}
): Promise<VerifyQuizAssetsResult> {
  const repoRoot = await resolveRepoRoot(options.repoRoot ?? process.cwd());
  const manifestPath =
    resolveRelativePath(
      repoRoot,
      options.manifestPath ?? DEFAULT_MANIFEST_PATH
    ) ?? path.resolve(repoRoot, DEFAULT_MANIFEST_PATH);
  const errors: string[] = [];
  const manifest = await readManifest(manifestPath, errors);

  if (manifest) {
    await verifyManifestFiles(repoRoot, manifest, errors);
    await verifyManifestCompleteness(repoRoot, manifest, errors);
  }
  try {
    await verifyNoReferenceImports(repoRoot, errors);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Unable to verify quiz source references: ${message}`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
