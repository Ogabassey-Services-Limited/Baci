import { rewriteBaciDeepLinkPath } from '@/lib/baci-deep-link';
import { rewriteJumiaDeepLinkPath } from '@/lib/jumia-deep-link';

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  return rewriteBaciDeepLinkPath(rewriteJumiaDeepLinkPath(path));
}
