import { createHash } from 'node:crypto';

export function frozenRouteHashFinding(
  path: string,
  source: string | Buffer,
  expectedHash: string
): string | undefined {
  const actualHash = createHash('sha256').update(source).digest('hex');
  return actualHash === expectedHash
    ? undefined
    : `${path}: frozen route hash ${actualHash}`;
}
