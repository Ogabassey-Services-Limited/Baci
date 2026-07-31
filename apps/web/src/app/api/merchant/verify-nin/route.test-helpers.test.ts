import { describe, expect, it } from 'vitest';
import { makeRequest, validNinBody } from './route.test-helpers';

describe('verify NIN route test helpers', () => {
  it('builds a request containing the supplied verification payload', async () => {
    const request = makeRequest(validNinBody);

    await expect(request.json()).resolves.toEqual(validNinBody);
  });
});
