import Constants from 'expo-constants';
import { z } from 'zod';

const MobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z
    .string()
    .url()
    .default('https://ogabassey.usebaci.com'),
});

function readExpoExtraApiUrl() {
  const value = Constants.expoConfig?.extra?.apiUrl;
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function readPublicApiUrl() {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  return value && value.length > 0 ? value : undefined;
}

const env = MobileEnvSchema.parse({
  EXPO_PUBLIC_API_URL: readPublicApiUrl() || readExpoExtraApiUrl(),
});

export const { EXPO_PUBLIC_API_URL } = env;
