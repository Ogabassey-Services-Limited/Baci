import { writeFile } from 'node:fs/promises';
import { measureVercelStorefrontCost } from './measure-vercel-storefront-cost';
import type { WindowOptions } from './measure-vercel-storefront-cost-types';

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

async function runMeasurementCli(): Promise<void> {
  const parsed = parseMeasurementArgs(process.argv.slice(2));
  const result = await measureVercelStorefrontCost(parsed);
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (parsed.outputPath) {
    await writeFile(parsed.outputPath, serialized, { mode: 0o600 });
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
