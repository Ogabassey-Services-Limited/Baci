import Constants from 'expo-constants';

export type ExpoExtraConfig = {
  supabaseAnonKey?: string;
  supabasePublishableKey?: string;
  supabaseUrl?: string;
};

export function getExpoExtraConfig(): ExpoExtraConfig {
  const expoExtra = Constants.expoConfig?.extra;

  if (!expoExtra || typeof expoExtra !== 'object') {
    return {};
  }

  return expoExtra as ExpoExtraConfig;
}

export function getConfiguredSupabaseUrl(
  expoExtra: ExpoExtraConfig = getExpoExtraConfig()
): string {
  const configuredUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL || expoExtra.supabaseUrl || '';

  try {
    return configuredUrl && new URL(configuredUrl) ? configuredUrl : '';
  } catch {
    return '';
  }
}
