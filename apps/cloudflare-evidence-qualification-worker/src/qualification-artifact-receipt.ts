import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
  const bindings = source.match(/env\.([A-Z0-9_]+)/g) ?? [];
  if (bindings.length !== 1 || bindings[0] !== 'env.CF_VERSION_METADATA')
    throw new Error('worker has an invalid version-metadata binding');
  return Object.freeze({
    canonicalSourceSha256: sha256(source),
    configSha256: sha256(config),
    dependencyLockSha256: sha256(lock),
    wranglerVersion: build.wranglerVersion,
    generatedTypeSha256: sha256(build.generatedTypeDeclaration),
    moduleListSha256: sha256(JSON.stringify([...build.moduleList].sort())),
    bundleSha256: sha256(build.bundle),
    soleVersionMetadataBinding: 'CF_VERSION_METADATA',
  });
}
