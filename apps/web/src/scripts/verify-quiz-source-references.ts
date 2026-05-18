import { readFile, readdir, stat, type Dirent } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_SCAN_ROOTS = [
  'apps/mobile-storefront/app',
  'apps/mobile-storefront/components',
  'apps/mobile-storefront/hooks',
  'apps/mobile-storefront/lib',
  'apps/mobile-storefront/services',
  'apps/mobile-storefront/stores',
];
const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
]);
const MAX_SOURCE_WALK_DEPTH = 100;

function findForbiddenPatterns(contents: string): string[] {
  const foundPatterns: string[] = [];
  let remainingContents = contents;

  // findForbiddenPatterns removes longer matches from remainingContents so the
  // generic tmp/quiz-mobile fallback does not double-count overlapping paths.
  for (const pattern of [
    '/tmp/quiz-mobile',
    '\\\\tmp\\\\quiz-mobile',
    '\\tmp\\quiz-mobile',
  ]) {
    if (!remainingContents.includes(pattern)) continue;
    foundPatterns.push(pattern);
    remainingContents = remainingContents.replaceAll(pattern, '');
  }

  if (remainingContents.includes('tmp/quiz-mobile')) {
    foundPatterns.push('tmp/quiz-mobile');
  }

  return foundPatterns;
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

async function walkSourceFiles(
  directory: string,
  visitFile: (filePath: string) => Promise<void>,
  depth = 0
) {
  if (depth > MAX_SOURCE_WALK_DEPTH) {
    throw new Error(
      `Quiz asset source walk exceeded ${MAX_SOURCE_WALK_DEPTH} levels`
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
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      await walkSourceFiles(entryPath, visitFile, depth + 1);
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      await visitFile(entryPath);
    }
  }
}

export async function verifyNoReferenceImports(
  repoRoot: string,
  errors: string[]
) {
  for (const sourceRoot of SOURCE_SCAN_ROOTS) {
    const absoluteRoot = path.join(repoRoot, sourceRoot);
    if (!(await directoryExists(absoluteRoot))) continue;

    await walkSourceFiles(absoluteRoot, async (filePath) => {
      const contents = await readFile(filePath, 'utf8');
      const relativeFilePath = path.relative(repoRoot, filePath);

      for (const pattern of findForbiddenPatterns(contents)) {
        errors.push(
          `Forbidden quiz-mobile reference in ${relativeFilePath}: ${pattern}`
        );
      }
    });
  }
}
