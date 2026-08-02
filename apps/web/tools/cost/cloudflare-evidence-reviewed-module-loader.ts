import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ReviewedEvidenceModuleSource } from './cloudflare-evidence-runner-modules';

const loadModule = createRequire(import.meta.url);

function importReviewedEntrypoint(entry: string) {
  if (process.env.VITEST === 'true') return loadModule(entry) as unknown;
  const { tsImport } = loadModule('tsx/esm/api') as {
    tsImport: (specifier: string, parentUrl: string) => Promise<unknown>;
  };
  return tsImport(pathToFileURL(entry).href, import.meta.url);
}

function destinationPath(
  workspaceRoot: string,
  temporaryRoot: string,
  path: string
) {
  const relativePath = relative(resolve(workspaceRoot), resolve(path));
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    isAbsolute(relativePath)
  )
    throw new Error('reviewed module source is outside the workspace');
  return join(temporaryRoot, relativePath);
}

/**
 * Imports a verified module closure from immutable bytes in private storage.
 *
 * The callback is required so factories and deferred imports run while the
 * private extracted closure is still available. Callers must not retain the
 * loaded module after this promise resolves.
 */
export async function importReviewedEvidenceModule<T>(
  workspaceRoot: string,
  entrypoint: string,
  files: readonly ReviewedEvidenceModuleSource[],
  use: (loaded: unknown) => Promise<T> | T
): Promise<T> {
  if (typeof use !== 'function')
    throw new Error('reviewed module loader requires a lifetime callback');
  const temporaryRoot = await mkdtemp(
    join(resolve(workspaceRoot), '.baci-reviewed-module-')
  );
  try {
    for (const file of files) {
      const destination = destinationPath(
        workspaceRoot,
        temporaryRoot,
        file.path
      );
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, file.source, { mode: 0o600 });
    }
    const entry = destinationPath(workspaceRoot, temporaryRoot, entrypoint);
    const loaded = await importReviewedEntrypoint(entry);
    return await use(loaded);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(
      () => undefined
    );
  }
}
