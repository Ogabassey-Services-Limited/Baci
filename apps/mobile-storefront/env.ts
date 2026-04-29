import Constants from 'expo-constants';
import { z } from 'zod';

const MobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url().default('https://usebaci.com'),
});

function readExpoExtraApiUrl() {
  const value =
    typeof Constants.expoConfig?.extra?.apiUrl === 'string'
      ? Constants.expoConfig.extra.apiUrl.trim()
      : undefined;
  return value && value.length > 0 ? value : undefined;
}

function readPublicApiUrl() {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  return value && value.length > 0 ? value : undefined;
}

const rawEnv = {
  EXPO_PUBLIC_API_URL: readPublicApiUrl() || readExpoExtraApiUrl(),
};

const parsedEnv = MobileEnvSchema.safeParse(rawEnv);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(
    `Invalid mobile environment configuration (${details}). ` +
      `Received EXPO_PUBLIC_API_URL=${JSON.stringify(rawEnv.EXPO_PUBLIC_API_URL)}.`
  );
}

export const { EXPO_PUBLIC_API_URL } = parsedEnv.data;
