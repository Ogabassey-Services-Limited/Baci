import Constants from 'expo-constants';

export const IS_DEV =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';

const DEFAULT_PRODUCTION_URL = 'https://usebaci.com';

function getHostFromHostUri(hostUri: string): string {
  const trimmedHostUri = hostUri.trim().split('/')[0] || hostUri.trim();
  const bracketedIpv6Match = trimmedHostUri.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6Match) {
    return bracketedIpv6Match[1];
  }

  const simpleHostMatch = trimmedHostUri.match(/^([^:]+)(?::\d+)?$/);
  if (simpleHostMatch) {
    return simpleHostMatch[1];
  }

  const lastColonIndex = trimmedHostUri.lastIndexOf(':');
  if (lastColonIndex > -1) {
    const portCandidate = trimmedHostUri.slice(lastColonIndex + 1);
    if (/^\d+$/.test(portCandidate)) {
      return trimmedHostUri.slice(0, lastColonIndex);
    }
  }

  return trimmedHostUri;
}

function formatBaseUrlHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

function isLikelyLocalDevUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      return true;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    const privateRange172 = hostname.match(/^172\.(\d{1,3})\./);
    if (privateRange172) {
      const secondOctet = Number(privateRange172[1]);
      return secondOctet >= 16 && secondOctet <= 31;
    }

    return false;
  } catch {
    return false;
  }
}

function isLinkLocalHost(host: string): boolean {
  return /^169\.254\.\d{1,3}\.\d{1,3}$/.test(host);
}

export function resolveBaseUrl(
  options: {
    isDev?: boolean;
    configuredBaseUrl?: string;
    fallbackConfiguredBaseUrl?: string;
    hostUri?: string;
  } = {}
): string {
  const {
    isDev = IS_DEV,
    configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL,
    fallbackConfiguredBaseUrl = process.env.EXPO_PUBLIC_WEB_API_URL,
    hostUri = Constants.expoConfig?.hostUri,
  } = options;

  if (isDev) {
    if (hostUri) {
      const host = getHostFromHostUri(hostUri);
      const detectedLocalUrl = `http://${formatBaseUrlHost(host)}:3000`;

      if (configuredBaseUrl && isLinkLocalHost(host)) {
        return configuredBaseUrl.replace(/\/+$/, '');
      }

      if (fallbackConfiguredBaseUrl && isLinkLocalHost(host)) {
        return fallbackConfiguredBaseUrl.replace(/\/+$/, '');
      }

      if (configuredBaseUrl && isLikelyLocalDevUrl(configuredBaseUrl)) {
        return configuredBaseUrl.replace(/\/+$/, '');
      }

      if (
        fallbackConfiguredBaseUrl &&
        isLikelyLocalDevUrl(fallbackConfiguredBaseUrl)
      ) {
        return fallbackConfiguredBaseUrl.replace(/\/+$/, '');
      }

      return detectedLocalUrl;
    }

    if (configuredBaseUrl && isLikelyLocalDevUrl(configuredBaseUrl)) {
      return configuredBaseUrl.replace(/\/+$/, '');
    }
    if (
      fallbackConfiguredBaseUrl &&
      isLikelyLocalDevUrl(fallbackConfiguredBaseUrl)
    ) {
      return fallbackConfiguredBaseUrl.replace(/\/+$/, '');
    }

    return 'http://localhost:3000';
  }

  return (configuredBaseUrl || DEFAULT_PRODUCTION_URL).replace(/\/+$/, '');
}

export const BASE_URL = resolveBaseUrl();
