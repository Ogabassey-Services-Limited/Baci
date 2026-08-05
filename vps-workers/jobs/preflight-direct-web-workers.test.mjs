import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDirectWorkerPreflightProblems } from './preflight-direct-web-workers.mjs';

const commonEnv = {
  BACI_REPO_DIR: '/opt/baci/app',
  BACI_WEB_BASE_URL: 'https://usebaci.com',
  EXPO_ACCESS_TOKEN: 'expo-token',
  GIGL_BASE_URL: 'https://gigl.example.com',
  GIGL_EMAIL: 'worker@example.com',
  GIGL_PASSWORD: 'provider-password',
  IMEI_IDENTIFIER_ENCRYPTION_KEY: 'encryption-key',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  PETROCK_API_TOKEN: 'petrock-token',
  PETROCK_ENABLED: 'true',
  PETROCK_ENABLED_TIERS: 'blacklist',
  PETROCK_REMEDIATION_ENABLED: 'true',
  QUIZ_PHASE: '1a',
  QUIZ_PRODUCTION_APPROVED: 'false',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ZEPTOMAIL_TOKEN: 'zeptomail-token',
};

describe('direct worker environment preflight', () => {
  it('accepts an explicitly configured pre-launch environment', () => {
    assert.deepEqual(getDirectWorkerPreflightProblems(commonEnv), []);
  });

  it('reports only missing variable names', () => {
    const problems = getDirectWorkerPreflightProblems({
      ...commonEnv,
      PETROCK_API_TOKEN: '',
      QUIZ_PRODUCTION_APPROVED: '',
    });

    assert.deepEqual(problems, [
      'PETROCK_API_TOKEN is required',
      'QUIZ_PRODUCTION_APPROVED is required',
    ]);
    assert.doesNotMatch(problems.join(' '), /petrock-token|service-role-key/);
  });

  it('requires an explicit full-checkout path for direct TypeScript jobs', () => {
    const problems = getDirectWorkerPreflightProblems({
      ...commonEnv,
      BACI_REPO_DIR: '',
    });

    assert.deepEqual(problems, ['BACI_REPO_DIR is required']);
  });

  it('requires the notification credential used by Petrock reconciliation', () => {
    const problems = getDirectWorkerPreflightProblems({
      ...commonEnv,
      ZEPTOMAIL_TOKEN: '',
    });

    assert.deepEqual(problems, ['ZEPTOMAIL_TOKEN is required']);
  });

  it('requires the direct GIGL provider and notification environment', () => {
    const problems = getDirectWorkerPreflightProblems({
      ...commonEnv,
      EXPO_ACCESS_TOKEN: '',
      GIGL_BASE_URL: '',
    });

    assert.deepEqual(problems, [
      'EXPO_ACCESS_TOKEN is required',
      'GIGL_BASE_URL is required',
    ]);
  });

  for (const disabledValue of ['0', 'false', 'off', ' OFF ']) {
    it(`does not require provider credentials when GIGL is disabled with ${disabledValue}`, () => {
      const problems = getDirectWorkerPreflightProblems({
        ...commonEnv,
        GIGL_BASE_URL: '',
        GIGL_EMAIL: '',
        GIGL_ENABLED: disabledValue,
        GIGL_PASSWORD: '',
      });

      assert.deepEqual(problems, []);
    });
  }

  it('requires the full quiz production gate', () => {
    const problems = getDirectWorkerPreflightProblems({
      ...commonEnv,
      QUIZ_PHASE: 'production',
      QUIZ_PRODUCTION_APPROVED: 'true',
    });

    assert.deepEqual(problems, [
      'QUIZ_RPC_SERVER_SECRET is required for production',
      'QUIZ_DEVICE_HASH_PEPPER is required for production',
    ]);
  });

  it('rejects a short production quiz device pepper', () => {
    const problems = getDirectWorkerPreflightProblems({
      ...commonEnv,
      QUIZ_DEVICE_HASH_PEPPER: 'too-short',
      QUIZ_PHASE: 'production',
      QUIZ_PRODUCTION_APPROVED: 'true',
      QUIZ_RPC_SERVER_SECRET: 'rpc-secret',
    });

    assert.deepEqual(problems, [
      'QUIZ_DEVICE_HASH_PEPPER must be at least 32 characters',
    ]);
  });

  it('rejects an unsafe Petrock remediation origin', () => {
    assert.deepEqual(
      getDirectWorkerPreflightProblems({
        ...commonEnv,
        BACI_WEB_BASE_URL: 'http://user:password@usebaci.com',
      }),
      ['BACI_WEB_BASE_URL must be credential-free HTTPS']
    );
  });

  for (const baseUrl of [
    'https://user:password@gigl.example.com',
    'http://gigl.example.com',
  ]) {
    it(`rejects the unsafe GIGL provider origin ${baseUrl}`, () => {
      assert.deepEqual(
        getDirectWorkerPreflightProblems({
          ...commonEnv,
          GIGL_BASE_URL: baseUrl,
        }),
        ['GIGL_BASE_URL must be credential-free HTTPS']
      );
    });
  }
});
