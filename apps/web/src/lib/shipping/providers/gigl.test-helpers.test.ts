import { describe, expect, it } from 'vitest';
import {
  abortingFetchResponse,
  baseUrl,
  jsonResponse,
  loginResponseWithToken,
} from './gigl.test-helpers';

describe('GIGL test helpers', () => {
  it('builds JSON responses for provider fixtures', async () => {
    await expect(jsonResponse({ ok: true }).json()).resolves.toEqual({
      ok: true,
    });
  });

  it('builds token-specific login envelopes', () => {
    expect(loginResponseWithToken('token-1').data.data['access-token']).toBe(
      'token-1'
    );
    expect(baseUrl).toContain('thirdpartynode');
  });

  it('rejects hanging fetch fixtures when their signal aborts', async () => {
    const controller = new AbortController();
    const responsePromise = abortingFetchResponse('/login', {
      signal: controller.signal,
    });

    controller.abort();

    await expect(responsePromise).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
