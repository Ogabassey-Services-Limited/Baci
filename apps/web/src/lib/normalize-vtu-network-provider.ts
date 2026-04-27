import { NetworkProvider } from '@/lib/kuda';

const VALID_NETWORK_PROVIDERS = new Set<string>(Object.values(NetworkProvider));
const LEGACY_9MOBILE_ALIAS = 'T2';

const NETWORK_PROVIDER_ALIASES: Record<string, NetworkProvider> = {
  // Some mobile clients and provider payloads still use the old Etisalat/T2 label.
  [LEGACY_9MOBILE_ALIAS]: NetworkProvider.MOBILE_9,
};

function isNetworkProvider(provider: string): provider is NetworkProvider {
  return VALID_NETWORK_PROVIDERS.has(provider);
}

export function normalizeVtuNetworkProvider(
  provider: string
): NetworkProvider | null {
  const normalizedProvider = provider.trim().toUpperCase();
  const aliasedProvider = NETWORK_PROVIDER_ALIASES[normalizedProvider];
  if (aliasedProvider) {
    return aliasedProvider;
  }

  if (isNetworkProvider(normalizedProvider)) {
    return normalizedProvider;
  }

  return null;
}
