import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readSourceInventory(
  root: string,
  paths: readonly string[]
): { missingPaths: string[]; sources: Map<string, string> } {
  const missingPaths: string[] = [];
  const sources = new Map<string, string>();
  for (const path of paths) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) {
      missingPaths.push(path);
      continue;
    }
    sources.set(path, readFileSync(absolute, 'utf8'));
  }
  return { missingPaths: missingPaths.sort(), sources };
}
