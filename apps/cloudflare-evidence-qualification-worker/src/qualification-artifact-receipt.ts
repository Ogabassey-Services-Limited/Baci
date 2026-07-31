import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'comment-json';

type ArtifactBuild = Readonly<{
  bundle: Uint8Array;
  moduleList: readonly string[];
  generatedTypeDeclaration: string;
  wranglerVersion: string;
}>;
export type ArtifactBuildRunner = Readonly<{
  dryRun(configPath: string, outputDirectory: string): Promise<ArtifactBuild>;
}>;
export type QualificationArtifactReceipt = Readonly<{
  canonicalSourceSha256: string;
  configSha256: string;
  dependencyLockSha256: string;
  wranglerVersion: string;
  generatedTypeSha256: string;
  moduleListSha256: string;
  bundleSha256: string;
  soleVersionMetadataBinding: 'CF_VERSION_METADATA';
}>;
const sha256 = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
const forbiddenConfigKeys = new Set([
  'route',
  'routes',
  'custom_domains',
  'vars',
  'secrets',
  'r2_buckets',
  'services',
  'durable_objects',
  'queues',
  'analytics_engine_datasets',
]);
const canonicalConfigJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalConfigJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalConfigJson(item)}`)
    .join(',')}}`;
};

/** Parses the Wrangler JSONC authority surface; no source code implies bindings. */
export function validateQualificationWorkerConfig(configText: string) {
  const parsed = parse<Record<string, unknown>>(configText, null, true);
  const keys = Object.keys(parsed);
  if (keys.some((key) => forbiddenConfigKeys.has(key)))
    throw new Error('forbidden Worker config authority');
  if (
    keys.length !== 4 ||
    !['name', 'main', 'compatibility_date', 'version_metadata'].every((key) =>
      keys.includes(key)
    ) ||
    !parsed.version_metadata ||
    typeof parsed.version_metadata !== 'object' ||
    Array.isArray(parsed.version_metadata) ||
    Object.keys(parsed.version_metadata as Record<string, unknown>).join(
      ','
    ) !== 'binding' ||
    (parsed.version_metadata as { binding?: unknown }).binding !==
      'CF_VERSION_METADATA'
  )
    throw new Error(
      'Worker config must contain exactly one version_metadata binding'
    );
  return Object.freeze({
    binding: 'CF_VERSION_METADATA' as const,
    canonicalSha256: sha256(canonicalConfigJson(parsed)),
  });
}

/** Produces a receipt only from an injected dry-run build and canonical local inputs. */
export async function buildQualificationArtifactReceipt(
  root: string,
  version: 'a' | 'b',
  runner: ArtifactBuildRunner
): Promise<QualificationArtifactReceipt> {
  const [source, config, lock] = await Promise.all([
    readFile(resolve(root, `src/version-${version}.ts`), 'utf8'),
    readFile(resolve(root, `wrangler.version-${version}.jsonc`), 'utf8'),
    readFile(resolve(root, '../../pnpm-lock.yaml'), 'utf8'),
  ]);
  const build = await runner.dryRun(
    resolve(root, `wrangler.version-${version}.jsonc`),
    resolve(root, `.qualification-dist/${version}`)
  );
  if (!/^4\.115\.0$/.test(build.wranglerVersion))
    throw new Error('dry-run did not use the pinned Wrangler version');
  const qualificationConfig = validateQualificationWorkerConfig(config);
  return Object.freeze({
    canonicalSourceSha256: sha256(source),
    configSha256: qualificationConfig.canonicalSha256,
    dependencyLockSha256: sha256(lock),
    wranglerVersion: build.wranglerVersion,
    generatedTypeSha256: sha256(build.generatedTypeDeclaration),
    moduleListSha256: sha256(JSON.stringify([...build.moduleList].sort())),
    bundleSha256: sha256(build.bundle),
    soleVersionMetadataBinding: qualificationConfig.binding,
  });
}
