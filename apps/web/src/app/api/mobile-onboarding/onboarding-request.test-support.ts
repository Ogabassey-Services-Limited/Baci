import { NextRequest } from 'next/server';

/** Shared request fixtures for the mobile-onboarding route suites. */
export function makeOnboardingRequest(
  body: Record<string, unknown>,
  headers: HeadersInit = {}
): NextRequest {
  return new NextRequest('http://localhost/api/mobile-onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export const validOnboardingBody = {
  email: 'test@example.com',
  password: 'StrongP@ss123!',
  confirmPassword: 'StrongP@ss123!',
  firstName: 'John',
  lastName: 'Doe',
  businessName: 'Test Store',
  businessType: 'fashion',
  country: 'NG',
  brandColors: JSON.stringify({
    primary: '#000',
    background: '#fff',
    accent: '#F59E0B',
  }),
};
