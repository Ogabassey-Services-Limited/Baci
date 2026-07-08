import type { useToast } from '@/hooks/use-toast';
import { apiGet, apiPatch, apiPost, fetchWithCsrf } from '@/lib/api-client';
import {
  isRecord,
  type PaymentCredentialStatusResponse,
  type PaypalMode,
  type PaypalVaultEnvironment,
} from './paypal-provider-status';

/**
 * Network calls for the PayPal BYOK connection card. Kept out of
 * `paypal-provider-card.tsx` so the component file stays under the repo's
 * 300-line budget; every function here is a thin, independently-testable
 * wrapper around the shared `lib/api-client` helpers.
 */

export type ToastFn = ReturnType<typeof useToast>['toast'];

const PAYPAL_CREDENTIALS_URL = '/api/merchant/payment-credentials';
const PAYPAL_STATUS_URL = `${PAYPAL_CREDENTIALS_URL}?provider=paypal`;
const FEATURES_URL = '/api/merchant/features';

/**
 * Loads both halves of the card's state in parallel: the non-secret
 * `paypal_enabled` / `paypal_mode` config (from feature settings) and the
 * write-only credential status (from the vault). Each half fails
 * independently so one outage never blanks out the other.
 */
export async function loadPaypalCardData(options: {
  setStatus: (value: PaymentCredentialStatusResponse | null) => void;
  setEnabled: (value: boolean) => void;
  setMode: (value: PaypalMode) => void;
  setCustomSettings: (value: Record<string, unknown>) => void;
  setLoading: (value: boolean) => void;
  toast: ToastFn;
}): Promise<void> {
  const {
    setStatus,
    setEnabled,
    setMode,
    setCustomSettings,
    setLoading,
    toast,
  } = options;

  const [featureSettings, credentialStatus] = await Promise.allSettled([
    apiGet<{ custom_settings?: unknown }>(FEATURES_URL),
    apiGet<PaymentCredentialStatusResponse>(PAYPAL_STATUS_URL),
  ]);

  if (featureSettings.status === 'fulfilled') {
    const customSettings = isRecord(featureSettings.value.custom_settings)
      ? featureSettings.value.custom_settings
      : {};
    setCustomSettings(customSettings);
    setEnabled(customSettings.paypal_enabled === true);
    setMode(customSettings.paypal_mode === 'live' ? 'live' : 'sandbox');
  } else {
    console.error(
      'Failed to load PayPal feature settings:',
      featureSettings.reason
    );
    toast({
      variant: 'destructive',
      title: 'Failed to load settings',
      description: 'Unable to load PayPal configuration. Please refresh.',
    });
  }

  if (credentialStatus.status === 'fulfilled') {
    setStatus(credentialStatus.value);
  } else {
    console.error(
      'Failed to load PayPal connection status:',
      credentialStatus.reason
    );
    toast({
      variant: 'destructive',
      title: 'Failed to load PayPal status',
      description: 'Unable to fetch the PayPal connection status.',
    });
  }

  setLoading(false);
}

/** Merge-patches `custom_settings` so unrelated keys are never clobbered. */
export async function persistPaypalFeatureConfig(
  patch: Partial<{ paypal_enabled: boolean; paypal_mode: PaypalMode }>,
  customSettings: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const updated = await apiPatch<{ custom_settings?: unknown }>(FEATURES_URL, {
    custom_settings: { ...customSettings, ...patch },
  });
  return isRecord(updated.custom_settings)
    ? updated.custom_settings
    : { ...customSettings, ...patch };
}

/**
 * Validate-on-save: the API authenticates against PayPal with the submitted
 * credentials before storing them, so a rejection here means PayPal itself
 * refused the client ID/secret pair.
 */
export function savePaypalCredentials(payload: {
  environment: PaypalVaultEnvironment;
  clientId: string;
  secretKey: string;
}): Promise<PaymentCredentialStatusResponse> {
  return apiPost<PaymentCredentialStatusResponse>(PAYPAL_CREDENTIALS_URL, {
    provider: 'paypal',
    ...payload,
  });
}

/** apiDelete() has no body support; the DELETE route requires `{ provider }`. */
export async function deletePaypalCredentials(): Promise<PaymentCredentialStatusResponse> {
  const response = await fetchWithCsrf(PAYPAL_CREDENTIALS_URL, {
    method: 'DELETE',
    body: JSON.stringify({ provider: 'paypal' }),
  });
  const data = await response.json().catch(() => ({ error: 'Request failed' }));
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Request failed'
    );
  }
  return data as PaymentCredentialStatusResponse;
}
