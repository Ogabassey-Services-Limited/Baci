import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parse } from 'comment-json';

type ArtifactBuild = Readonly<{
  bundle: Uint8Array;
  moduleList: readonly string[];
  generatedTypeDeclaration: string;
  wranglerVersion: string;
}>;
export const QUALIFICATION_WORKER_NAME = 'baci-evidence-qualification';
export const QUALIFICATION_COMPATIBILITY_DATE = '2026-07-31';
export const QUALIFICATION_WRANGLER_VERSION = '4.115.0';
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
export function validateQualificationWorkerConfig(
  configText: string,
  expectedMain: string
) {
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
  if (parsed.name !== QUALIFICATION_WORKER_NAME)
    throw new Error('Worker config name does not match the reviewed fixture');
  if (parsed.compatibility_date !== QUALIFICATION_COMPATIBILITY_DATE)
    throw new Error(
      'Worker config compatibility date does not match the reviewed fixture'
    );
  if (
    !['src/version-a.ts', 'src/version-b.ts'].includes(
      typeof parsed.main === 'string' ? parsed.main : ''
    ) ||
    parsed.main !== expectedMain
  )
    throw new Error(
      'Worker config main does not match the reviewed entrypoint'
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
  if (build.wranglerVersion !== QUALIFICATION_WRANGLER_VERSION)
    throw new Error('dry-run did not use the pinned Wrangler version');
  const expectedMain = `src/version-${version}.ts`;
  const qualificationConfig = validateQualificationWorkerConfig(
    config,
    expectedMain
  );
  if (!Array.isArray(build.moduleList) || build.moduleList.length === 0)
    throw new Error(
      'dry-run module graph does not bind the reviewed entrypoint'
    );
  const canonicalRoot = resolve(root);
  const canonicalModules = build.moduleList.map((module) => {
    if (typeof module !== 'string' || !module)
      throw new Error('dry-run module graph contains an invalid module path');
    const candidate = isAbsolute(module)
      ? resolve(module)
      : resolve(canonicalRoot, module);
    return relative(canonicalRoot, candidate).split(sep).join('/');
  });
  if (!canonicalModules.includes(expectedMain))
    throw new Error(
      'dry-run module graph does not bind the reviewed entrypoint'
    );
  if (canonicalModules.length !== 1 || canonicalModules[0] !== expectedMain)
    throw new Error('dry-run module graph contains unexpected fixture modules');
  return Object.freeze({
    canonicalSourceSha256: sha256(source),
    configSha256: qualificationConfig.canonicalSha256,
    dependencyLockSha256: sha256(lock),
    wranglerVersion: build.wranglerVersion,
    generatedTypeSha256: sha256(build.generatedTypeDeclaration),
    moduleListSha256: sha256(JSON.stringify([...canonicalModules].sort())),
    bundleSha256: sha256(build.bundle),
    soleVersionMetadataBinding: qualificationConfig.binding,
  });
}
