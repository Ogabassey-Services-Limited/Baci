import { isStorefrontPdpSemanticTimeout } from './is-storefront-pdp-semantic-timeout';
import { storefrontPdpSemanticReadCooldown } from './storefront-pdp-semantic-read-cooldown-singleton';
import {
  type AbortableQuery,
  runStorefrontPdpSemanticRpc,
  type StorefrontPdpSemanticRpcOptions,
} from './storefront-pdp-semantic-rpc';

export async function runStorefrontPdpSemanticRpcWithCooldown<T>(
  query: AbortableQuery<T>,
  options: StorefrontPdpSemanticRpcOptions,
  scope: string
) {
  try {
    return await runStorefrontPdpSemanticRpc(query, options);
  } catch (error) {
    if (isStorefrontPdpSemanticTimeout(error)) {
      storefrontPdpSemanticReadCooldown.markFailure(scope);
    }
    throw error;
  }
}
