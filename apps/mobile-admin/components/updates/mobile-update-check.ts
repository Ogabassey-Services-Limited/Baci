import { shouldDeferMobileUpdatePrompt } from './mobile-update-route-safety';

export interface MobileReleasePolicy {
  enabled: boolean;
  latestNativeVersion: string | null;
  message: string | null;
  minNativeVersion: string | null;
  nativeUpdateRecommended: boolean;
  nativeUpdateRequired: boolean;
  storeUrl: string | null;
}

export type MobileUpdatePrompt =
  | {
      kind: 'native-recommended' | 'native-required';
      message: string;
      storeUrl: string | null;
    }
  | {
      kind: 'ota-available';
      message: string;
    };

export type MobileUpdatePromptResult =
  | MobileUpdatePrompt
  | { kind: 'deferred' | 'none' };

type SupportedPlatform = 'android' | 'ios';

interface ResolveMobileUpdatePromptInput {
  apiBaseUrl: string;
  buildNumber: string | null | undefined;
  channel: string | null | undefined;
  checkForUpdateAsync: () => Promise<{ isAvailable?: boolean }>;
  fetchPolicy?: (url: string) => Promise<MobileReleasePolicy>;
  isOtaEnabled: boolean;
  nativeVersion: string | null | undefined;
  pathname: string | null | undefined;
  platform: SupportedPlatform | string;
  runtimeVersion: string | null | undefined;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildReleasePolicyUrl(input: ResolveMobileUpdatePromptInput) {
  const url = new URL('/api/mobile/release-policy', input.apiBaseUrl);
  url.searchParams.set('app', 'admin');
  url.searchParams.set('platform', input.platform);
  url.searchParams.set('runtimeVersion', input.runtimeVersion ?? '');
  url.searchParams.set('nativeVersion', input.nativeVersion ?? '');
  url.searchParams.set('buildNumber', input.buildNumber ?? '');
  url.searchParams.set('channel', input.channel ?? '');
  return url.toString();
}

export async function fetchMobileReleasePolicy(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Release policy request failed: ${response.status}`);
  }
  return (await response.json()) as MobileReleasePolicy;
}

export async function resolveMobileUpdatePrompt(
  input: ResolveMobileUpdatePromptInput
): Promise<MobileUpdatePromptResult> {
  if (shouldDeferMobileUpdatePrompt(input.pathname)) {
    return { kind: 'deferred' };
  }

  if (input.platform !== 'android' && input.platform !== 'ios') {
    return { kind: 'none' };
  }

  if (
    !hasText(input.apiBaseUrl) ||
    !hasText(input.nativeVersion) ||
    !hasText(input.runtimeVersion) ||
    !hasText(input.channel) ||
    !hasText(input.buildNumber)
  ) {
    return { kind: 'none' };
  }

  try {
    const policy = await (input.fetchPolicy ?? fetchMobileReleasePolicy)(
      buildReleasePolicyUrl(input)
    );

    if (!policy.enabled) {
      return { kind: 'none' };
    }

    if (policy.nativeUpdateRequired) {
      if (!hasText(policy.storeUrl)) {
        return { kind: 'none' };
      }

      return {
        kind: 'native-required',
        message: policy.message ?? 'Install the latest app to continue.',
        storeUrl: policy.storeUrl,
      };
    }

    if (policy.nativeUpdateRecommended) {
      return {
        kind: 'native-recommended',
        message: policy.message ?? 'A newer app version is available.',
        storeUrl: policy.storeUrl,
      };
    }

    if (!input.isOtaEnabled) {
      return { kind: 'none' };
    }

    const update = await input.checkForUpdateAsync();
    return update.isAvailable
      ? {
          kind: 'ota-available',
          message: 'A faster version of the admin app is ready.',
        }
      : { kind: 'none' };
  } catch {
    return { kind: 'none' };
  }
}
