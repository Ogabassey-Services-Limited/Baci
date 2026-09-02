import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { measureVercelStorefrontCost } from './measure-vercel-storefront-cost';
import type { WindowOptions } from './measure-vercel-storefront-cost-types';

const SUPPORTED_MEASUREMENT_OPTIONS = new Set([
  '--project-id',
  '--before',
  '--before-sha',
  '--before-cache-probe',
  '--before-db-trace',
  '--before-label',
  '--before-window-end',
  '--before-window-start',
  '--after',
  '--after-sha',
  '--after-cache-probe',
  '--after-db-trace',
  '--after-label',
  '--after-window-end',
  '--after-window-start',
  '--out',
]);

export type MeasurementCliOptions = Readonly<{
  after?: { inputPath: string; window: WindowOptions };
  before: { inputPath: string; window: WindowOptions };
  outputPath?: string;
  projectId: string;
}>;

export function parseMeasurementArgs(
  args: readonly string[]
): MeasurementCliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || !value || values.has(key))
      throw new Error('measurement options are invalid');
    if (!SUPPORTED_MEASUREMENT_OPTIONS.has(key))
      throw new Error(`unknown measurement option: ${key}`);
    values.set(key, value);
  }
  const projectId = values.get('--project-id');
  const before = values.get('--before');
  const beforeSha = values.get('--before-sha');
  if (!projectId || !before || !beforeSha)
    throw new Error('--project-id, --before, and --before-sha are required');
  const window = (prefix: string, sha: string): WindowOptions => ({
    cacheProbePath: values.get(`--${prefix}-cache-probe`),
    dbTracePath: values.get(`--${prefix}-db-trace`),
    deploymentSha: sha,
    label: values.get(`--${prefix}-label`) ?? prefix,
    requestedWindowEnd: values.get(`--${prefix}-window-end`),
    requestedWindowStart: values.get(`--${prefix}-window-start`),
  });
  const after = values.get('--after');
  const afterSha = values.get('--after-sha');
  const hasAfterOptions = Array.from(values.keys()).some((key) =>
    key.startsWith('--after-')
  );
  if (!after && hasAfterOptions)
    throw new Error('--after is required with --after-* options');
  if (after && !afterSha)
    throw new Error('--after-sha is required with --after');
  return {
    after:
      after && afterSha
        ? { inputPath: after, window: window('after', afterSha) }
        : undefined,
    before: { inputPath: before, window: window('before', beforeSha) },
    outputPath: values.get('--out'),
    projectId,
  };
}

/** Replaces a report atomically with a newly-created private file. */
export async function writeMeasurementReport(
  outputPath: string,
  serialized: string
): Promise<void> {
  const temporaryDirectory = await mkdtemp(
    join(dirname(outputPath), '.vercel-cost-report-')
  );
  const temporaryPath = join(temporaryDirectory, 'report.json');
  try {
    await writeFile(temporaryPath, serialized, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

async function runMeasurementCli(): Promise<void> {
  const parsed = parseMeasurementArgs(process.argv.slice(2));
  const result = await measureVercelStorefrontCost(parsed);
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (parsed.outputPath) {
    await writeMeasurementReport(parsed.outputPath, serialized);
  } else {
    process.stdout.write(serialized);
  }
}

if (process.argv[1]?.endsWith('measure-vercel-storefront-cost-cli.ts')) {
  void runMeasurementCli().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'measurement failed';
    console.error(message);
    process.exitCode = 1;
  });
}
