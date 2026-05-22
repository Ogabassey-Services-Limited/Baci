import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatFailure } from './check-route-size-report.mjs';

const MAX_LINES = 300;
const ROUTE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
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

    if (!ROUTE_EXTENSIONS.has(path.extname(entry.name))) {
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

function findRouteFiles(projectRoot) {
  const appRoot = path.join(projectRoot, 'app');
  if (!existsSync(appRoot)) return [];

  return listFiles(appRoot)
    .map((absolutePath) => normalizePath(path.relative(projectRoot, absolutePath)))
    .sort();
}

function readRouteSizes(projectRoot) {
  return findRouteFiles(projectRoot).map((relativePath) => {
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
    throw new Error('routes entries must have string "path" and positive integer "lineCount".');
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

  if (!Array.isArray(rawBaseline.routes)) {
    throw new Error('Baseline must include a routes array.');
  }

  const routes = rawBaseline.routes.map(normalizeBaselineEntry);
  const seenPaths = new Set();
  for (const route of routes) {
    if (seenPaths.has(route.path)) {
      throw new Error(`Duplicate route baseline entry: ${route.path}`);
    }
    seenPaths.add(route.path);
  }

  return {
    maxLines,
    routes,
  };
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function buildReport({ baseline, routeSizes }) {
  const routeSizeByPath = new Map(routeSizes.map((route) => [route.path, route]));
  const baselineByPath = new Map(baseline.routes.map((route) => [route.path, route]));
  const oversizedRoutes = routeSizes.filter((route) => route.lineCount > baseline.maxLines);

  const newOversizedRoutes = oversizedRoutes.filter((route) => !baselineByPath.has(route.path));
  const grownRoutes = oversizedRoutes
    .filter((route) => {
      const baselineRoute = baselineByPath.get(route.path);
      return baselineRoute && route.lineCount > baselineRoute.lineCount;
    })
    .map((route) => ({
      ...route,
      baselineLineCount: baselineByPath.get(route.path).lineCount,
    }));

  const shrunkenBaselineEntries = baseline.routes.flatMap((baselineRoute) => {
    const route = routeSizeByPath.get(baselineRoute.path);
    if (!route) return [];
    if (route.lineCount <= baseline.maxLines) return [];
    if (route.lineCount >= baselineRoute.lineCount) return [];

    return [
      {
        ...baselineRoute,
        currentLineCount: route.lineCount,
        reason: `now ${route.lineCount} lines, lower the baseline from ${baselineRoute.lineCount}`,
      },
    ];
  });

  const staleBaselineEntries = baseline.routes.flatMap((baselineRoute) => {
    const route = routeSizeByPath.get(baselineRoute.path);
    if (!route) {
      return [{ ...baselineRoute, reason: 'file is missing' }];
    }
    if (route.lineCount <= baseline.maxLines) {
      return [
        {
          ...baselineRoute,
          currentLineCount: route.lineCount,
          reason: `now ${route.lineCount} lines, remove the baseline entry`,
        },
      ];
    }
    return [];
  });

  return {
    grownRoutes,
    newOversizedRoutes,
    oversizedRoutes,
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
    console.error(`[route-size] ${message}`);
    process.exitCode = 1;
    return;
  }

  const scriptFile = fileURLToPath(import.meta.url);
  const defaultProjectRoot = path.resolve(path.dirname(scriptFile), '..');
  const projectRoot = path.resolve(options.projectRoot ?? defaultProjectRoot);
  const baselinePath = path.resolve(
    options.baselinePath ?? path.join(projectRoot, 'config', 'route-size-baseline.json')
  );

  if (!existsSync(baselinePath)) {
    console.error(`[route-size] Missing baseline file: ${baselinePath}`);
    process.exitCode = 1;
    return;
  }

  let baseline;
  try {
    baseline = parseBaseline(JSON.parse(readFileSync(baselinePath, 'utf8')));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[route-size] Malformed baseline file ${baselinePath}: ${message}`);
    process.exitCode = 1;
    return;
  }

  const routeSizes = readRouteSizes(projectRoot);
  const report = buildReport({ baseline, routeSizes });

  if (
    report.newOversizedRoutes.length === 0 &&
    report.grownRoutes.length === 0 &&
    report.shrunkenBaselineEntries.length === 0 &&
    report.staleBaselineEntries.length === 0
  ) {
    const baselineCount = report.oversizedRoutes.length;
    console.log(
      `[route-size] OK: ${baselineCount} oversized ${pluralize(
        baselineCount,
        'route baseline'
      )} within the decreasing ${baseline.maxLines}-line budget.`
    );
    return;
  }

  console.error(formatFailure({ baseline, report }));
  process.exitCode = 1;
}

main();
