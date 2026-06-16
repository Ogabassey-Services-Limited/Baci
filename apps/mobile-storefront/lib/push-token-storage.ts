import AsyncStorage from '@react-native-async-storage/async-storage';

export const PUSH_TOKEN_STORAGE_KEY = '@baci_storefront_push_token';

// Per-user key — prevents user A's opt-out silencing user B on a shared device
export const pushOptOutKey = (userId: string) =>
  `@baci_storefront_push_opt_out_${userId}`;

// All helpers are fail-open: reads return null/false on error, writes swallow errors.
// A storage failure must never abort a sign-out or settings flow.

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function storeLocalPushToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch {
    // Fail-open: local persistence is best-effort
  }
}

export async function clearStoredPushToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    // Fail-open
  }
}

export async function isPushOptedOut(userId: string): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(pushOptOutKey(userId));
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setPushOptOut(
  userId: string,
  optOut: boolean
): Promise<void> {
  try {
    if (optOut) {
      await AsyncStorage.setItem(pushOptOutKey(userId), 'true');
    } else {
      await AsyncStorage.removeItem(pushOptOutKey(userId));
    }
  } catch {
    // Fail-open
  }
}
