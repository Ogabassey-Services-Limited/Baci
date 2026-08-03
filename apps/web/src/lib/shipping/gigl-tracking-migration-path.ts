import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveGiglTrackingMigrationPath(
  relativePath: string,
  expectedFilename: string
): string {
  const resolvedPath = fileURLToPath(new URL(relativePath, import.meta.url));
  if (basename(resolvedPath) !== expectedFilename) {
    throw new Error(
      `Unexpected GIGL tracking migration path: ${basename(resolvedPath)}`
    );
  }

  return resolvedPath;
}
