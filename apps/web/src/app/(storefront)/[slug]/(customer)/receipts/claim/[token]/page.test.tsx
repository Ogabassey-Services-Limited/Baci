import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReceiptClaimPage from './page';

const mockPush = vi.fn();
const mockFetchWithCsrf = vi.fn();
const mockUseCustomerAuth = vi.fn();
const mockUseMerchant = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'claim-token' }),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: () => mockUseCustomerAuth(),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => mockUseMerchant(),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return {
    ok: init.status ? init.status < 400 : true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response;
}

const previewBody = {
  claim: {
    claimed: false,
    customerName: 'Bassey John',
    devices: ['iPhone 16 Pro Max', '2 x AirPods Pro'],
    merchantName: 'Ogabassey',
  },
};

describe('ReceiptClaimPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createJsonResponse(previewBody))
    );
    mockUseCustomerAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    mockUseMerchant.mockReturnValue({
      basePath: '',
      loading: false,
    });
    mockFetchWithCsrf.mockResolvedValue(
      createJsonResponse({ redirectPath: '/receipts', success: true })
    );
  });

  it('shows the personalized preview and routes guests to login with a return URL', async () => {
    render(<ReceiptClaimPage />);

    expect(await screen.findByText('Welcome Bassey John')).toBeInTheDocument();
    expect(screen.getByText('iPhone 16 Pro Max')).toBeInTheDocument();
    expect(screen.getByText('2 x AirPods Pro')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in to claim receipt' })
    );

    expect(mockPush).toHaveBeenCalledWith(
      '/account/login?redirect=%2Freceipts%2Fclaim%2Fclaim-token'
    );
  });

  it('redeems the claim and sends authenticated customers to receipts', async () => {
    mockUseCustomerAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    mockUseMerchant.mockReturnValue({
      basePath: '/ogabassey',
      loading: false,
    });

    render(<ReceiptClaimPage />);

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        '/api/storefront/receipts/claims/claim-token',
        { method: 'POST' }
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/ogabassey/receipts');
    });
  });

  it('does not redeem an already-claimed receipt link', async () => {
    mockUseCustomerAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse({
        claim: {
          ...previewBody.claim,
          claimed: true,
        },
      })
    );

    render(<ReceiptClaimPage />);

    expect(await screen.findByText('Welcome Bassey John')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This receipt link has already been claimed. You can view it from the receipts panel.'
      )
    ).toBeInTheDocument();
    expect(mockFetchWithCsrf).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'View receipts' }));

    expect(mockPush).toHaveBeenCalledWith('/receipts');
  });

  it('shows an error and does not navigate when redemption fails', async () => {
    mockUseCustomerAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    mockFetchWithCsrf.mockResolvedValue(
      createJsonResponse(
        {
          error:
            'Sign in with the email address that received this receipt link',
          success: false,
        },
        { status: 403 }
      )
    );

    render(<ReceiptClaimPage />);

    expect(
      await screen.findByText(
        'Sign in with the email address that received this receipt link'
      )
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows expired link errors from the preview endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse(
        { error: 'Receipt claim link has expired' },
        { status: 410 }
      )
    );

    render(<ReceiptClaimPage />);

    expect(
      await screen.findByText('Receipt claim link has expired')
    ).toBeInTheDocument();
    expect(mockFetchWithCsrf).not.toHaveBeenCalled();
  });
});
