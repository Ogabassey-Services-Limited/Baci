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

export const env = parseMobileEnv(process.env);
