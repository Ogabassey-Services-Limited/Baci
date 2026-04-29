import { MobileEnvSchema } from './env';

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
});
