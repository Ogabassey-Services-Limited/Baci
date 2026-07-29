import { isStoreReadiness, type WebStoreReadiness } from '@baci/shared';

export function isWebStoreReadiness(
  value: unknown
): value is WebStoreReadiness {
  return isStoreReadiness(value) && value.surface === 'web';
}
