import Constants from 'expo-constants';
import { z } from 'zod';

const DEFAULT_MOBILE_API_URL = 'https://usebaci.com';

function emptyStringToUndefined(value: unknown) {
  return typeof value === 'string' && value.trim().length === 0
    ? undefined
    : value;
}

export const MobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().url().optional().default(DEFAULT_MOBILE_API_URL)
  ),
});

export type MobileEnv = z.infer<typeof MobileEnvSchema>;

function formatEnvError(error: z.ZodError<MobileEnv>) {
  return error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
}

export function parseMobileEnv(rawEnv: unknown): MobileEnv {
  const result = MobileEnvSchema.safeParse(rawEnv);
  if (!result.success) {
    throw new Error(
      `Invalid mobile environment configuration (${formatEnvError(result.error)}).`
    );
  }
  return result.data;
}

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

let parsedEnv: MobileEnv;
try {
  parsedEnv = parseMobileEnv(rawEnv);
} catch (error) {
  const message =
    error instanceof Error
      ? error.message.replace(/\.$/, '')
      : 'Invalid mobile environment configuration';
  throw new Error(
    `${message}. ` +
      `Received EXPO_PUBLIC_API_URL=${JSON.stringify(rawEnv.EXPO_PUBLIC_API_URL)}.`
  );
}

export const { EXPO_PUBLIC_API_URL } = parsedEnv;
