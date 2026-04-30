// Keep '@/env' as the canonical mobile environment module because it owns both
// schema validation and runtime Expo/process env resolution. This file exists
// as a schema-directory compatibility re-export.
export {
  MobileEnvSchema,
  parseMobileEnv,
  type MobileEnv,
} from '@/env';
