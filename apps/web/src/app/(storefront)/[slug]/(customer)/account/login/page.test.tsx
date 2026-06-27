import { render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerLoginPage from './page';

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
const mockUseCustomerAuth = vi.fn();
const mockUseMerchant = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) =>
    createElement('img', { alt, src }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: () => mockUseCustomerAuth(),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => mockUseMerchant(),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: vi.fn((path) => path || '/'),
}));

describe('CustomerLoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('email');
    mockSearchParams.delete('redirect');
    mockUseMerchant.mockReturnValue({
      loading: false,
      merchant: {
        brand_colors: { primary: '#dc2626' },
        business_name: 'Future Merchant',
        custom_domain: 'futuremerchant.com',
        logo_url: null,
        slug: 'future-merchant',
        template_id: 'default',
      },
    });
    mockUseCustomerAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      otpState: null,
      sendOtp: vi.fn(),
      signInWithGoogle: vi.fn(),
      verifyOtp: vi.fn(),
    });
  });

  it('prefills a valid email query parameter', () => {
    mockSearchParams.set('email', '  BasseyBJohn@Yahoo.CO.UK  ');

    render(<CustomerLoginPage />);

    expect(screen.getByLabelText('Email address')).toHaveValue(
      'basseybjohn@yahoo.co.uk'
    );
  });

  it('ignores invalid email query parameters', () => {
    mockSearchParams.set('email', 'https://evil.example');

    render(<CustomerLoginPage />);

    expect(screen.getByLabelText('Email address')).toHaveValue('');
  });

  it('prefills receipt claim login email from the token redirect', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ emailHint: '  BasseyBJohn@Yahoo.CO.UK  ' }),
          { status: 200 }
        )
    );
    vi.stubGlobal('fetch', fetchMock);
    mockSearchParams.set('redirect', '/receipts/claim/token_123');

    render(<CustomerLoginPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Email address')).toHaveValue(
        'basseybjohn@yahoo.co.uk'
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/storefront/receipts/claims/token_123/login-email',
      { headers: { accept: 'application/json' } }
    );
  });
});
