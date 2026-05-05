import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCAN_DIRECTORIES = ['app', 'components', 'hooks', 'lib', 'services', 'stores', 'utils'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const PLATFORM_PATTERN = /Platform\.(?:OS|select)/;
const IGNORED_SUFFIXES = ['.test.ts', '.test.tsx', '.test.js', '.test.jsx'];
const FORBIDDEN_PATTERNS = [
  {
    id: 'ios-keyboard-avoidance',
    description:
      "Do not disable Android keyboard avoidance with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`.",
    pattern:
      /behavior\s*=\s*\{\s*Platform\.OS\s*===\s*['"]ios['"]\s*\?\s*['"]padding['"]\s*:\s*undefined\s*\}/,
  },
];

function listFiles(rootDir) {
  const output = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFiles(fullPath));
      continue;
    }

    if (EXTENSIONS.has(path.extname(entry.name))) {
      output.push(fullPath);
    }
  }

  return output;
}

function isIgnored(relativePath) {
  return IGNORED_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));
}

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function createPatternKey(file, patternId) {
  return `${file}::${patternId}`;
}

function normalizePathEntry(entry, context) {
  if (typeof entry === 'string') {
    return normalizePath(entry);
  }

  if (entry && typeof entry === 'object' && typeof entry.path === 'string') {
    return normalizePath(entry.path);
  }

  throw new Error(`${context} entries must be strings or objects with a string "path".`);
}

function normalizeKnownForbiddenEntry(entry) {
  if (
    entry &&
    typeof entry === 'object' &&
    typeof entry.path === 'string' &&
    typeof entry.patternId === 'string'
  ) {
    return {
      path: normalizePath(entry.path),
      patternId: entry.patternId,
    };
  }

  throw new Error('knownForbiddenPatterns entries must be objects with string "path" and "patternId".');
}

function parseAllowlist(rawAllowlist) {
  if (Array.isArray(rawAllowlist)) {
    return {
      knownForbiddenPatterns: [],
      platformBranches: rawAllowlist.map((entry) => normalizePathEntry(entry, 'allowlist')),
    };
  }

  if (!rawAllowlist || typeof rawAllowlist !== 'object') {
    throw new Error('Allowlist must be an array or object.');
  }

  const platformBranches = Array.isArray(rawAllowlist.platformBranches)
    ? rawAllowlist.platformBranches.map((entry) => normalizePathEntry(entry, 'platformBranches'))
    : [];
  const knownForbiddenPatterns = Array.isArray(rawAllowlist.knownForbiddenPatterns)
    ? rawAllowlist.knownForbiddenPatterns.map(normalizeKnownForbiddenEntry)
    : [];

  return { knownForbiddenPatterns, platformBranches };
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-root') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --project-root');
      options.projectRoot = value;
      index += 1;
      continue;
    }
    if (arg === '--allowlist') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --allowlist');
      options.allowlistPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readProjectFile(projectRoot, relativePath, sourceCache) {
  if (sourceCache.has(relativePath)) return sourceCache.get(relativePath);
  const source = readFileSync(path.join(projectRoot, relativePath), 'utf8');
  sourceCache.set(relativePath, source);
  return source;
}

export function findPlatformBranchFiles(projectRoot, sourceCache = new Map()) {
  return SCAN_DIRECTORIES.flatMap((directory) => {
    const absoluteDirectory = path.join(projectRoot, directory);
    if (!existsSync(absoluteDirectory)) return [];

    return listFiles(absoluteDirectory)
      .map((absolutePath) => normalizePath(path.relative(projectRoot, absolutePath)))
      .filter((relativePath) => !isIgnored(relativePath))
      .filter((relativePath) => {
        const source = readProjectFile(projectRoot, relativePath, sourceCache);
        return PLATFORM_PATTERN.test(source);
      });
  }).sort();
}

export function findForbiddenPatternViolations(projectRoot, relativePaths, sourceCache = new Map()) {
  return relativePaths.flatMap((relativePath) => {
    const source = readProjectFile(projectRoot, relativePath, sourceCache);

    return FORBIDDEN_PATTERNS.filter(({ pattern }) => pattern.test(source)).map(
      ({ description, id }) => ({
        description,
        file: relativePath,
        patternId: id,
      })
    );
  });
}

export function findNonAllowlistedFiles(foundFiles, platformBranches) {
  const platformBranchSet = new Set(platformBranches);

  return foundFiles.filter((relativePath) => !platformBranchSet.has(relativePath));
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[platform-drift] ${message}`);
    process.exitCode = 1;
    return;
  }

  const scriptFile = fileURLToPath(import.meta.url);
  const defaultProjectRoot = path.resolve(path.dirname(scriptFile), '..');
  const projectRoot = path.resolve(options.projectRoot ?? defaultProjectRoot);
  const allowlistPath = path.resolve(
    options.allowlistPath ??
      path.join(projectRoot, 'config', 'platform-branch-allowlist.json')
  );

  if (!existsSync(allowlistPath)) {
    console.error(`[platform-drift] Missing allowlist file: ${allowlistPath}`);
    process.exitCode = 1;
    return;
  }

  let allowlist;
  try {
    allowlist = parseAllowlist(JSON.parse(readFileSync(allowlistPath, 'utf8')));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[platform-drift] Malformed allowlist file ${allowlistPath}: ${message}`
    );
    process.exitCode = 1;
    return;
  }

  const sourceCache = new Map();
  const foundFiles = findPlatformBranchFiles(projectRoot, sourceCache);
  const nonAllowlistedFiles = findNonAllowlistedFiles(
    foundFiles,
    allowlist.platformBranches
  );
  const violations = findForbiddenPatternViolations(projectRoot, foundFiles, sourceCache);
  const knownForbiddenSet = new Set(
    allowlist.knownForbiddenPatterns.map(({ path: knownPath, patternId }) =>
      createPatternKey(knownPath, patternId)
    )
  );
  const violationSet = new Set(
    violations.map(({ file, patternId }) => createPatternKey(file, patternId))
  );
  const unbaselinedViolations = violations.filter(
    ({ file, patternId }) => !knownForbiddenSet.has(createPatternKey(file, patternId))
  );
  const staleKnownForbiddenPatterns = allowlist.knownForbiddenPatterns.filter(
    ({ path: knownPath, patternId }) =>
      !violationSet.has(createPatternKey(knownPath, patternId))
  );

  if (
    nonAllowlistedFiles.length === 0 &&
    unbaselinedViolations.length === 0 &&
    staleKnownForbiddenPatterns.length === 0
  ) {
    console.log(
      `[platform-drift] OK: ${allowlist.platformBranches.length} allowlisted platform-specific ${pluralize(
        allowlist.platformBranches.length,
        'file'
      )}, ${allowlist.knownForbiddenPatterns.length} known forbidden pattern ${pluralize(
        allowlist.knownForbiddenPatterns.length,
        'baseline'
      )}, no new forbidden drift patterns found.`
    );
    return;
  }

  if (nonAllowlistedFiles.length > 0) {
    console.error('[platform-drift] New files with Platform.OS / Platform.select:');
    for (const file of nonAllowlistedFiles) {
      console.error(`- ${file}`);
    }
  }

  if (unbaselinedViolations.length > 0) {
    console.error('[platform-drift] Forbidden platform patterns found:');
    for (const violation of unbaselinedViolations) {
      console.error(`- ${violation.file}: ${violation.description}`);
    }
  }

  if (staleKnownForbiddenPatterns.length > 0) {
    console.error(
      '[platform-drift] Stale known forbidden pattern baselines; remove these from config/platform-branch-allowlist.json:'
    );
    for (const staleEntry of staleKnownForbiddenPatterns) {
      console.error(`- ${staleEntry.path}: ${staleEntry.patternId}`);
    }
  }

  process.exitCode = 1;
}

const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPoint === fileURLToPath(import.meta.url)) {
  main();
}
