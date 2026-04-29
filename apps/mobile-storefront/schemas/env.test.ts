import { MobileEnvSchema } from '@/schemas/env';

describe('MobileEnvSchema', () => {
  it('parses a valid public API URL', () => {
    expect(
      MobileEnvSchema.parse({ EXPO_PUBLIC_API_URL: 'https://usebaci.com' })
    ).toEqual({
      EXPO_PUBLIC_API_URL: 'https://usebaci.com',
    });
  });

  it('rejects malformed public API URLs', () => {
    expect(
      MobileEnvSchema.safeParse({ EXPO_PUBLIC_API_URL: 'not-a-url' }).success
    ).toBe(false);
  });

  it('uses the local default when the public API URL is missing or blank', () => {
    expect(MobileEnvSchema.parse({})).toEqual({
      EXPO_PUBLIC_API_URL: 'http://localhost:3000',
    });
    expect(MobileEnvSchema.parse({ EXPO_PUBLIC_API_URL: undefined })).toEqual({
      EXPO_PUBLIC_API_URL: 'http://localhost:3000',
    });
    expect(MobileEnvSchema.parse({ EXPO_PUBLIC_API_URL: '' })).toEqual({
      EXPO_PUBLIC_API_URL: 'http://localhost:3000',
    });
  });

  it('accepts supported URL protocol and format variations', () => {
    expect(
      MobileEnvSchema.parse({ EXPO_PUBLIC_API_URL: 'http://example.com' })
    ).toEqual({
      EXPO_PUBLIC_API_URL: 'http://example.com',
    });
    expect(
      MobileEnvSchema.parse({ EXPO_PUBLIC_API_URL: 'http://localhost:3000' })
    ).toEqual({
      EXPO_PUBLIC_API_URL: 'http://localhost:3000',
    });
    expect(
      MobileEnvSchema.parse({ EXPO_PUBLIC_API_URL: 'https://usebaci.com/' })
    ).toEqual({
      EXPO_PUBLIC_API_URL: 'https://usebaci.com/',
    });
  });
});
