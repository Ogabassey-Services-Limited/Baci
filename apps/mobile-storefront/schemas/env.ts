import { z } from 'zod';

export const MobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url().default('https://usebaci.com'),
});

export type MobileEnv = z.infer<typeof MobileEnvSchema>;
