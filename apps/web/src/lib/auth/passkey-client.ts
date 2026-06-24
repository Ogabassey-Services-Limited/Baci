import { createClient } from '@/lib/supabase/client';

export const PASSKEY_STATE_CHANGED_EVENT = 'baci:passkey-state-changed';

/**
 * Shared browser-side passkey helpers wrapping the Supabase Auth passkey SDK
 * (Beta). Centralises the loosely-typed `supabase.auth` passkey surface so the
 * Settings card and the post-login enrollment prompt share one definition.
 */
export type PasskeyMetadata = {
  created_at: string;
  friendly_name?: string;
  id: string;
  last_used_at?: string;
};

export type PasskeyApiResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type SupabaseAuthWithPasskeys = {
  passkey?: {
    delete?: (input: {
      passkeyId: string;
    }) => Promise<PasskeyApiResult<unknown>>;
    list?: () => Promise<PasskeyApiResult<PasskeyMetadata[]>>;
  };
  registerPasskey?: () => Promise<PasskeyApiResult<PasskeyMetadata>>;
};

export function notifyPasskeyStateChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(PASSKEY_STATE_CHANGED_EVENT));
}

function getPasskeyApi(): SupabaseAuthWithPasskeys {
  const supabase = createClient();
  return supabase.auth as typeof supabase.auth & SupabaseAuthWithPasskeys;
}

/** List the signed-in user's registered passkeys. */
export function listPasskeys(): Promise<PasskeyApiResult<PasskeyMetadata[]>> {
  const api = getPasskeyApi();
  if (!api.passkey?.list) {
    return Promise.resolve({
      data: null,
      error: { message: 'Passkey support is not enabled for this client.' },
    });
  }
  return api.passkey.list();
}

/** Register a new passkey for the signed-in user. */
export async function registerPasskey(): Promise<
  PasskeyApiResult<PasskeyMetadata>
> {
  const api = getPasskeyApi();
  if (!api.registerPasskey) {
    return {
      data: null,
      error: { message: 'Passkey registration is not available.' },
    };
  }
  const result = await api.registerPasskey();
  if (!result.error) {
    notifyPasskeyStateChanged();
  }
  return result;
}

/** Remove a registered passkey by id. */
export async function deletePasskey(
  passkeyId: string
): Promise<PasskeyApiResult<unknown>> {
  const api = getPasskeyApi();
  if (!api.passkey?.delete) {
    return {
      data: null,
      error: { message: 'Passkey deletion is not available.' },
    };
  }
  const result = await api.passkey.delete({ passkeyId });
  if (!result.error) {
    notifyPasskeyStateChanged();
  }
  return result;
}
