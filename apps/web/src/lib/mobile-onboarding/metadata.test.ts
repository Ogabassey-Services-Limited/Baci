import { describe, expect, it } from 'vitest';
import { readMobileOnboardingMetadata } from './metadata';

describe('readMobileOnboardingMetadata', () => {
  it('reads valid metadata and preserves the provided slug', () => {
    const result = readMobileOnboardingMetadata({
      email: 'merchant@example.com',
      user_metadata: {
        full_name: 'John Doe',
        first_name: 'John',
        last_name: 'Doe',
        business_name: 'Test Store',
        business_type: 'fashion',
        slug: 'test-store',
        logo_url: 'https://cdn.usebaci.com/logo.png',
        brand_colors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      },
    });

    expect(result).toEqual({
      success: true,
      data: {
        email: 'merchant@example.com',
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Test Store',
        businessType: 'fashion',
        otherBusinessType: null,
        phone: null,
        slug: 'test-store',
        logoUrl: 'https://cdn.usebaci.com/logo.png',
        brandColors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      },
    });
  });

  it('parses brand colors stored as a JSON string', () => {
    const result = readMobileOnboardingMetadata({
      email: 'merchant@example.com',
      user_metadata: {
        business_name: 'Test Store',
        business_type: 'fashion',
        brand_colors: JSON.stringify({
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        }),
      },
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        slug: 'test-store',
        brandColors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      },
    });
  });

  it('returns a profile-incomplete error when required metadata is missing', () => {
    const result = readMobileOnboardingMetadata({
      email: 'merchant@example.com',
      user_metadata: {
        first_name: 'John',
      },
    });

    expect(result).toEqual({
      success: false,
      error: 'Account setup details are missing. Please complete your profile.',
    });
  });
});
