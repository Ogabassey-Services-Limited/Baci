import { rewriteJumiaDeepLinkPath } from '@/lib/jumia-deep-link';

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  return rewriteJumiaDeepLinkPath(path);
}
