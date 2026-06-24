import { describe, expect, it } from 'vitest';
import {
  getWrapperDefaultEnvKeys,
  loadEnvFile,
  setDefaultEnv,
} from './measure-ogabassey-cwv-utils.mjs';

describe('loadEnvFile', () => {
  it('loads quoted env values without overwriting existing keys', async () => {
    const env = { EXISTING: 'kept' };
    const loaded = await loadEnvFile('/tmp/.env.local', {
      env,
      readText: async () =>
        [
          '# ignored',
          'DEBUGBEAR_PROJECT_ID="101919"',
          "OGABASSEY_CWV_PSI='0'",
          'EXISTING=replaced',
        ].join('\n'),
    });

    expect(loaded).toBe(true);
    expect(env).toEqual({
      DEBUGBEAR_PROJECT_ID: '101919',
      EXISTING: 'kept',
      OGABASSEY_CWV_PSI: '0',
    });
  });

  it('can override root env-file values without replacing shell-owned keys', async () => {
    const shellOwned = new Set(['DEBUGBEAR_API_KEY']);
    const env = {
      DEBUGBEAR_API_KEY: 'shell-key',
      DEBUGBEAR_PROJECT_ID: 'root-project',
    };
    const loaded = await loadEnvFile('/apps/web/.env.local', {
      env,
      override: (key) => !shellOwned.has(key),
      readText: async () =>
        ['DEBUGBEAR_API_KEY=app-key', 'DEBUGBEAR_PROJECT_ID=app-project'].join(
          '\n'
        ),
    });

    expect(loaded).toBe(true);
    expect(env).toEqual({
      DEBUGBEAR_API_KEY: 'shell-key',
      DEBUGBEAR_PROJECT_ID: 'app-project',
    });
  });

  it('returns false when the env file is missing', async () => {
    await expect(
      loadEnvFile('/tmp/missing.env', {
        env: {},
        readText: () => {
          const error = new Error('missing');
          error.code = 'ENOENT';
          throw error;
        },
      })
    ).resolves.toBe(false);
  });
});

describe('setDefaultEnv', () => {
  it('tracks wrapper defaults so env files can override generated defaults', () => {
    const env = {};

    setDefaultEnv(env, 'OGABASSEY_PDP_LCP_URL', 'https://fallback.test/pdp', {
      track: true,
    });

    expect(env.OGABASSEY_PDP_LCP_URL).toBe('https://fallback.test/pdp');
    expect(getWrapperDefaultEnvKeys(env).has('OGABASSEY_PDP_LCP_URL')).toBe(
      true
    );
  });
});
