import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatFailure } from './check-module-size-report.mjs';

const MAX_LINES = 300;
const DEFAULT_ROOTS = ['components', 'hooks', 'lib', 'services', 'stores'];
const MODULE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORED_SUFFIXES = [
  '.spec.js',
  '.spec.jsx',
  '.spec.ts',
  '.spec.tsx',
  '.test.js',
  '.test.jsx',
  '.test.ts',
  '.test.tsx',
];

function normalizePath(value) {
  return value.replaceAll('\\', '/');
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
    if (arg === '--baseline') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --baseline');
      options.baselinePath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function listFiles(rootDir) {
  return readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      return listFiles(fullPath);
    }

    if (!MODULE_EXTENSIONS.has(path.extname(entry.name))) {
      return [];
    }

    if (IGNORED_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      return [];
    }

    return [fullPath];
  });
}

function countLines(source) {
  const normalizedSource = source.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  if (normalizedSource.length === 0) return 0;

  const newlineCount = normalizedSource.match(/\n/g)?.length ?? 0;
  return normalizedSource.endsWith('\n') ? newlineCount : newlineCount + 1;
}

function findModuleFiles(projectRoot, roots) {
  return roots
    .flatMap((root) => {
      const absoluteRoot = path.join(projectRoot, root);
      if (!existsSync(absoluteRoot)) return [];

      return listFiles(absoluteRoot).map((absolutePath) =>
        normalizePath(path.relative(projectRoot, absolutePath))
      );
    })
    .sort();
}

function readModuleSizes(projectRoot, roots) {
  return findModuleFiles(projectRoot, roots).map((relativePath) => {
    const source = readFileSync(path.join(projectRoot, relativePath), 'utf8');
    return {
      lineCount: countLines(source),
      path: relativePath,
    };
  });
}

function normalizeBaselineEntry(entry) {
  if (
    !entry ||
    typeof entry !== 'object' ||
    typeof entry.path !== 'string' ||
    !Number.isInteger(entry.lineCount) ||
    entry.lineCount < 1
  ) {
    throw new Error('modules entries must have string "path" and positive integer "lineCount".');
  }

  return {
    lineCount: entry.lineCount,
    path: normalizePath(entry.path),
  };
}

function parseBaseline(rawBaseline) {
  if (!rawBaseline || typeof rawBaseline !== 'object') {
    throw new Error('Baseline must be an object.');
  }

  const maxLines = rawBaseline.maxLines ?? MAX_LINES;
  if (!Number.isInteger(maxLines) || maxLines < 1) {
    throw new Error('maxLines must be a positive integer.');
  }

  const roots =
    rawBaseline.roots === undefined ? DEFAULT_ROOTS : rawBaseline.roots;
  if (
    !Array.isArray(roots) ||
    roots.length === 0 ||
    roots.some((root) => typeof root !== 'string' || root.length === 0)
  ) {
    throw new Error('roots must be a non-empty string array.');
  }

  if (!Array.isArray(rawBaseline.modules)) {
    throw new Error('Baseline must include a modules array.');
  }

  const modules = rawBaseline.modules.map(normalizeBaselineEntry);
  const seenPaths = new Set();
  for (const module of modules) {
    if (seenPaths.has(module.path)) {
      throw new Error(`Duplicate module baseline entry: ${module.path}`);
    }
    seenPaths.add(module.path);
  }

  return {
    maxLines,
    modules,
    roots: roots.map(normalizePath),
  };
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function buildReport({ baseline, moduleSizes }) {
  const moduleSizeByPath = new Map(moduleSizes.map((module) => [module.path, module]));
  const baselineByPath = new Map(baseline.modules.map((module) => [module.path, module]));
  const oversizedModules = moduleSizes.filter(
    (module) => module.lineCount > baseline.maxLines
  );

  const newOversizedModules = oversizedModules.filter(
    (module) => !baselineByPath.has(module.path)
  );
  const grownModules = oversizedModules
    .filter((module) => {
      const baselineModule = baselineByPath.get(module.path);
      return baselineModule && module.lineCount > baselineModule.lineCount;
    })
    .map((module) => ({
      ...module,
      baselineLineCount: baselineByPath.get(module.path).lineCount,
    }));

  const shrunkenBaselineEntries = baseline.modules.flatMap((baselineModule) => {
    const module = moduleSizeByPath.get(baselineModule.path);
    if (!module) return [];
    if (module.lineCount <= baseline.maxLines) return [];
    if (module.lineCount >= baselineModule.lineCount) return [];

    return [
      {
        ...baselineModule,
        currentLineCount: module.lineCount,
        reason: `now ${module.lineCount} lines, lower the baseline from ${baselineModule.lineCount}`,
      },
    ];
  });

  const staleBaselineEntries = baseline.modules.flatMap((baselineModule) => {
    const module = moduleSizeByPath.get(baselineModule.path);
    if (!module) {
      return [{ ...baselineModule, reason: 'file is missing' }];
    }
    if (module.lineCount <= baseline.maxLines) {
      return [
        {
          ...baselineModule,
          currentLineCount: module.lineCount,
          reason: `now ${module.lineCount} lines, remove the baseline entry`,
        },
      ];
    }
    return [];
  });

  return {
    grownModules,
    newOversizedModules,
    oversizedModules,
    shrunkenBaselineEntries,
    staleBaselineEntries,
  };
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[module-size] ${message}`);
    process.exitCode = 1;
    return;
  }

  const scriptFile = fileURLToPath(import.meta.url);
  const defaultProjectRoot = path.resolve(path.dirname(scriptFile), '..');
  const projectRoot = path.resolve(options.projectRoot ?? defaultProjectRoot);
  const baselinePath = path.resolve(
    options.baselinePath ?? path.join(projectRoot, 'config', 'module-size-baseline.json')
  );

  if (!existsSync(baselinePath)) {
    console.error(`[module-size] Missing baseline file: ${baselinePath}`);
    process.exitCode = 1;
    return;
  }

  let baseline;
  try {
    baseline = parseBaseline(JSON.parse(readFileSync(baselinePath, 'utf8')));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[module-size] Malformed baseline file ${baselinePath}: ${message}`);
    process.exitCode = 1;
    return;
  }

  const moduleSizes = readModuleSizes(projectRoot, baseline.roots);
  const report = buildReport({ baseline, moduleSizes });

  if (
    report.newOversizedModules.length === 0 &&
    report.grownModules.length === 0 &&
    report.shrunkenBaselineEntries.length === 0 &&
    report.staleBaselineEntries.length === 0
  ) {
    const baselineCount = report.oversizedModules.length;
    console.log(
      `[module-size] OK: ${baselineCount} oversized ${pluralize(
        baselineCount,
        'module baseline'
      )} within the decreasing ${baseline.maxLines}-line budget.`
    );
    return;
  }

  console.error(formatFailure({ baseline, report }));
  process.exitCode = 1;
}

main();
