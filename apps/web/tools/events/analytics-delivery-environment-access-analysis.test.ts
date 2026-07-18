import { describe, expect, it } from 'vitest';
import { readsCredentialEnvironment } from './analytics-delivery-environment-access-analysis';

describe('readsCredentialEnvironment', () => {
  it.each([
    'process.env.FACEBOOK_TOKEN',
    "process['e' + 'nv'].FACEBOOK_TOKEN",
    "globalThis['pro' + 'cess']['env'].FACEBOOK_TOKEN",
    'const runtime = globalThis.process; const environment = runtime.env; environment.FACEBOOK_TOKEN',
    'const { env: environment } = process; environment.FACEBOOK_TOKEN',
  ])('detects computed or aliased global environment access: %s', (source) => {
    expect(readsCredentialEnvironment('provider.ts', source)).toBe(true);
  });

  it('does not treat a shadowed process parameter as the global process', () => {
    expect(
      readsCredentialEnvironment(
        'provider.ts',
        'function read(process: { env: object }) { return process.env; }'
      )
    ).toBe(false);
  });
});
