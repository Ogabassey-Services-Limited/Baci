import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from 'dotenv';

const REQUIRED_ENV = [
  'BACI_REPO_DIR',
  'BACI_WEB_BASE_URL',
  'EXPO_ACCESS_TOKEN',
  'IMEI_IDENTIFIER_ENCRYPTION_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'PETROCK_API_TOKEN',
  'PETROCK_ENABLED',
  'PETROCK_ENABLED_TIERS',
  'PETROCK_REMEDIATION_ENABLED',
  'QUIZ_PHASE',
  'QUIZ_PRODUCTION_APPROVED',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ZEPTOMAIL_TOKEN',
];
const GIGL_REQUIRED_ENV = [
  'GIGL_BASE_URL',
  'GIGL_EMAIL',
  'GIGL_PASSWORD',
  'GIGL_TRACKING_DATABASE_URL',
];
const ENV_BOOLEAN_VALUES = new Set(['0', '1', 'false', 'no', 'true', 'yes']);
const DISABLED_GIGL_VALUES = new Set(['0', 'false', 'off']);
const SUPABASE_CA_SHA256 =
  '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';

function isConfigured(env, name) {
  return typeof env[name] === 'string' && env[name].trim().length > 0;
}

function isCredentialFreeHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function isGiglExplicitlyDisabled(env) {
  return DISABLED_GIGL_VALUES.has(env.GIGL_ENABLED?.trim().toLowerCase() ?? '');
}

function hasPinnedSupabaseCa(repoDir) {
  try {
    const certificate = readFileSync(
      join(repoDir, 'vps-workers/certs/supabase-prod-ca-2021.crt')
    );
    return (
      createHash('sha256').update(certificate).digest('hex') ===
      SUPABASE_CA_SHA256
    );
  } catch {
    return false;
  }
}

function isRestrictedGiglDatabaseUrl(value, supabaseUrlValue) {
  try {
    const url = new URL(value);
    const supabaseUrl = new URL(supabaseUrlValue);
    const projectRef = supabaseUrl.hostname.match(
      /^([a-z0-9]+)\.supabase\.co$/
    )?.[1];
    return (
      Boolean(projectRef) &&
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      url.username === `gigl_tracking_worker.${projectRef}` &&
      Boolean(url.password) &&
      url.hostname.endsWith('.pooler.supabase.com') &&
      url.port === '5432' &&
      url.pathname === '/postgres'
    );
  } catch {
    return false;
  }
}

export function getDirectWorkerPreflightProblems(env) {
  const problems = [];
  for (const name of REQUIRED_ENV) {
    if (!isConfigured(env, name)) {
      problems.push(`${name} is required`);
    }
  }

  const isGiglDisabled = isGiglExplicitlyDisabled(env);
  if (!isGiglDisabled) {
    for (const name of GIGL_REQUIRED_ENV) {
      if (!isConfigured(env, name)) {
        problems.push(`${name} is required`);
      }
    }
  }

  if (
    isConfigured(env, 'BACI_WEB_BASE_URL') &&
    !isCredentialFreeHttpsUrl(env.BACI_WEB_BASE_URL)
  ) {
    problems.push('BACI_WEB_BASE_URL must be credential-free HTTPS');
  }
  if (
    !isGiglDisabled &&
    isConfigured(env, 'BACI_REPO_DIR') &&
    !hasPinnedSupabaseCa(env.BACI_REPO_DIR)
  ) {
    problems.push('Supabase database CA certificate is missing or invalid');
  }
  if (
    !isGiglDisabled &&
    isConfigured(env, 'GIGL_BASE_URL') &&
    !isCredentialFreeHttpsUrl(env.GIGL_BASE_URL)
  ) {
    problems.push('GIGL_BASE_URL must be credential-free HTTPS');
  }
  if (
    !isGiglDisabled &&
    isConfigured(env, 'GIGL_TRACKING_DATABASE_URL') &&
    !isRestrictedGiglDatabaseUrl(
      env.GIGL_TRACKING_DATABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_URL
    )
  ) {
    problems.push(
      'GIGL_TRACKING_DATABASE_URL must use the restricted session-pooler role'
    );
  }

  for (const name of [
    'PETROCK_ENABLED',
    'PETROCK_REMEDIATION_ENABLED',
    'QUIZ_PRODUCTION_APPROVED',
  ]) {
    if (
      isConfigured(env, name) &&
      !ENV_BOOLEAN_VALUES.has(env[name].trim().toLowerCase())
    ) {
      problems.push(`${name} must be an explicit boolean`);
    }
  }

  const quizPhase = env.QUIZ_PHASE?.trim();
  if (
    isConfigured(env, 'QUIZ_PHASE') &&
    quizPhase !== '1a' &&
    quizPhase !== 'production'
  ) {
    problems.push('QUIZ_PHASE must be 1a or production');
  }
  if (quizPhase === 'production') {
    if (!isConfigured(env, 'QUIZ_RPC_SERVER_SECRET')) {
      problems.push('QUIZ_RPC_SERVER_SECRET is required for production');
    }
    if (!isConfigured(env, 'QUIZ_DEVICE_HASH_PEPPER')) {
      problems.push('QUIZ_DEVICE_HASH_PEPPER is required for production');
    } else if (env.QUIZ_DEVICE_HASH_PEPPER.trim().length < 32) {
      problems.push('QUIZ_DEVICE_HASH_PEPPER must be at least 32 characters');
    }
  }

  return problems;
}

function runDirectWorkerPreflight({
  env = process.env,
  logger = console,
} = {}) {
  const problems = getDirectWorkerPreflightProblems(env);
  if (problems.length > 0) {
    logger.error(`[direct-worker-preflight] ${problems.join(', ')}`);
    return 1;
  }

  logger.log(
    '[direct-worker-preflight] direct worker environment is configured'
  );
  return 0;
}

function main() {
  config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
  process.exitCode = runDirectWorkerPreflight();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
