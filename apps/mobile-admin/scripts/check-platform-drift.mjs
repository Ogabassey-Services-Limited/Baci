import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCAN_DIRECTORIES = [
  'app',
  'components',
  'hooks',
  'lib',
  'services',
  'stores',
  'utils',
];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const PLATFORM_PATTERN = /Platform\.(?:OS|select)/;
const IGNORED_SUFFIXES = ['.test.ts', '.test.tsx', '.test.js', '.test.jsx'];
const FORBIDDEN_PATTERNS = [
  {
    description:
      "Do not disable Android keyboard avoidance with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`.",
    pattern:
      /behavior=\{Platform\.OS === ['"]ios['"] \? ['"]padding['"] : undefined\}/,
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

export function findPlatformBranchFiles(projectRoot) {
  return SCAN_DIRECTORIES.flatMap((directory) => {
    const absoluteDirectory = path.join(projectRoot, directory);
    if (!existsSync(absoluteDirectory)) return [];

    return listFiles(absoluteDirectory)
      .map((absolutePath) => path.relative(projectRoot, absolutePath).replaceAll('\\', '/'))
      .filter((relativePath) => !isIgnored(relativePath))
      .filter((relativePath) => {
        const source = readFileSync(path.join(projectRoot, relativePath), 'utf8');
        return PLATFORM_PATTERN.test(source);
      });
  }).sort();
}

export function findForbiddenPatternViolations(projectRoot, relativePaths) {
  return relativePaths.flatMap((relativePath) => {
    const source = readFileSync(path.join(projectRoot, relativePath), 'utf8');

    return FORBIDDEN_PATTERNS.filter(({ pattern }) => pattern.test(source)).map(
      ({ description }) => ({
        description,
        file: relativePath,
      })
    );
  });
}

export function findNonAllowlistedFiles(foundFiles, allowlist) {
  const allowlistSet = new Set(allowlist);
  return foundFiles.filter((relativePath) => !allowlistSet.has(relativePath));
}

export function findStaleAllowlistEntries(allowlist, foundFiles) {
  const foundSet = new Set(foundFiles);
  return allowlist.filter((relativePath) => !foundSet.has(relativePath));
}

function main() {
  const scriptFile = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(scriptFile), '..');
  const allowlistPath = path.join(
    projectRoot,
    'config',
    'platform-branch-allowlist.json'
  );
  if (!existsSync(allowlistPath)) {
    console.error(
      `[platform-drift] Missing allowlist file: ${allowlistPath}`
    );
    process.exitCode = 1;
    return;
  }

  let allowlist;
  try {
    allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[platform-drift] Malformed allowlist file ${allowlistPath}: ${message}`
    );
    process.exitCode = 1;
    return;
  }

  const foundFiles = findPlatformBranchFiles(projectRoot);
  const nonAllowlistedFiles = findNonAllowlistedFiles(foundFiles, allowlist);
  const staleAllowlistEntries = findStaleAllowlistEntries(allowlist, foundFiles);
  // Forbidden patterns are only enforced on non-allowlisted files so existing
  // grandfathered files are not retroactively blocked.
  const violations = findForbiddenPatternViolations(
    projectRoot,
    nonAllowlistedFiles
  );

  if (
    nonAllowlistedFiles.length === 0 &&
    violations.length === 0 &&
    staleAllowlistEntries.length === 0
  ) {
    console.log(
      `[platform-drift] OK: ${foundFiles.length} allowlisted platform-specific files, no forbidden drift patterns found.`
    );
    return;
  }

  if (nonAllowlistedFiles.length > 0) {
    console.error('[platform-drift] New files with Platform.OS / Platform.select:');
    for (const file of nonAllowlistedFiles) {
      console.error(`- ${file}`);
    }
  }

  if (violations.length > 0) {
    console.error('[platform-drift] Forbidden platform patterns found:');
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.description}`);
    }
  }

  if (staleAllowlistEntries.length > 0) {
    console.error('[platform-drift] Stale allowlist entries:');
    for (const relativePath of staleAllowlistEntries) {
      console.error(`- ${relativePath}`);
    }
  }

  process.exitCode = 1;
}

const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPoint === fileURLToPath(import.meta.url)) {
  main();
}
