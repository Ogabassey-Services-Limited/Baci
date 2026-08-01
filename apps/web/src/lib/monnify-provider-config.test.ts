import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getMonnifyBaseUrl,
  getMonnifyCredentials,
} from './monnify-provider-config';

const originalMonnifyBaseUrl = process.env.MONNIFY_BASE_URL;
const originalMonnifyApiKey = process.env.MONNIFY_API_KEY;
const originalMonnifySecretKey = process.env.MONNIFY_SECRET_KEY;

afterEach(() => {
  if (originalMonnifyBaseUrl === undefined) {
    delete process.env.MONNIFY_BASE_URL;
  } else {
    process.env.MONNIFY_BASE_URL = originalMonnifyBaseUrl;
  }

  if (originalMonnifyApiKey === undefined) {
    delete process.env.MONNIFY_API_KEY;
  } else {
    process.env.MONNIFY_API_KEY = originalMonnifyApiKey;
  }

  if (originalMonnifySecretKey === undefined) {
    delete process.env.MONNIFY_SECRET_KEY;
  } else {
    process.env.MONNIFY_SECRET_KEY = originalMonnifySecretKey;
  }
});

describe('getMonnifyBaseUrl', () => {
  it('uses the production Monnify API when no provider base URL is configured', () => {
    delete process.env.MONNIFY_BASE_URL;

    expect(getMonnifyBaseUrl()).toBe('https://api.monnify.com');
  });

  it('uses an explicitly configured provider base URL without loading credential accessors', () => {
    process.env.MONNIFY_BASE_URL = 'https://sandbox.monnify.com';

    expect(getMonnifyBaseUrl()).toBe('https://sandbox.monnify.com');
  });

  it('returns only the server-owned credentials configured for Monnify authentication', () => {
    process.env.MONNIFY_API_KEY = 'provider-api-key';
    process.env.MONNIFY_SECRET_KEY = 'provider-secret-key';

    expect(getMonnifyCredentials()).toEqual({
      apiKey: 'provider-api-key',
      secretKey: 'provider-secret-key',
    });
  });
});
