import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleMerchantCustomerReviewsCard } from './google-merchant-customer-reviews-card';

const mockApiPatch = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('GoogleMerchantCustomerReviewsCard', () => {
  const submitSettingsForm = () => {
    fireEvent.submit(
      screen.getByRole('form', {
        name: /google customer reviews settings/i,
      })
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPatch.mockResolvedValue({
      custom_settings: {
        google_merchant_id: '112524323',
        agentic_agent_allowlist: ['chatgpt'],
      },
    });
  });

  it('loads the current Merchant Center ID from custom settings', () => {
    render(
      <GoogleMerchantCustomerReviewsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialCustomSettings={{ google_merchant_id: '112524323' }}
      />
    );

    expect(screen.getByLabelText(/merchant center id/i)).toHaveValue(
      '112524323'
    );
  });

  it('saves the numeric Merchant Center ID while preserving custom settings', async () => {
    render(
      <GoogleMerchantCustomerReviewsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialCustomSettings={{ agentic_agent_allowlist: ['chatgpt'] }}
      />
    );

    fireEvent.change(screen.getByLabelText(/merchant center id/i), {
      target: { value: ' 112524323 ' },
    });
    submitSettingsForm();

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        custom_settings: {
          agentic_agent_allowlist: ['chatgpt'],
          google_merchant_id: '112524323',
        },
        merchantId: '22222222-2222-4222-8222-222222222222',
      });
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Merchant Center ID saved' })
    );
  });

  it('blocks nonnumeric Merchant Center IDs before saving', async () => {
    render(
      <GoogleMerchantCustomerReviewsCard merchantId="22222222-2222-4222-8222-222222222222" />
    );

    fireEvent.change(screen.getByLabelText(/merchant center id/i), {
      target: { value: 'GMC-112524323' },
    });
    submitSettingsForm();

    await waitFor(() => {
      expect(mockApiPatch).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        /enter the numeric merchant center id/i
      );
    });
  });

  it('removes the Merchant Center ID when the field is cleared', async () => {
    mockApiPatch.mockResolvedValueOnce({
      custom_settings: {
        agentic_agent_allowlist: ['chatgpt'],
      },
    });

    render(
      <GoogleMerchantCustomerReviewsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialCustomSettings={{
          agentic_agent_allowlist: ['chatgpt'],
          google_merchant_id: '112524323',
        }}
      />
    );

    fireEvent.change(screen.getByLabelText(/merchant center id/i), {
      target: { value: '' },
    });
    submitSettingsForm();

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        custom_settings: {
          agentic_agent_allowlist: ['chatgpt'],
        },
        merchantId: '22222222-2222-4222-8222-222222222222',
      });
    });
  });

  it('resets for merchant B and ignores merchant A save completion after a switch', async () => {
    let resolveMerchantASave: (value: Record<string, unknown>) => void = () =>
      undefined;
    mockApiPatch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMerchantASave = resolve;
        })
    );

    const { rerender } = render(
      <GoogleMerchantCustomerReviewsCard
        merchantId="11111111-1111-4111-8111-111111111111"
        initialCustomSettings={{ google_merchant_id: '111111111' }}
      />
    );
    fireEvent.change(screen.getByLabelText(/merchant center id/i), {
      target: { value: '222222222' },
    });
    submitSettingsForm();

    rerender(
      <GoogleMerchantCustomerReviewsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialCustomSettings={{ google_merchant_id: '333333333' }}
      />
    );

    expect(screen.getByLabelText(/merchant center id/i)).toHaveValue(
      '333333333'
    );

    resolveMerchantASave({
      custom_settings: { google_merchant_id: '222222222' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/merchant center id/i)).toHaveValue(
        '333333333'
      );
    });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('accepts saves after the StrictMode lifecycle replay', async () => {
    render(
      <StrictMode>
        <GoogleMerchantCustomerReviewsCard
          merchantId="22222222-2222-4222-8222-222222222222"
          initialCustomSettings={{ google_merchant_id: '112524323' }}
        />
      </StrictMode>
    );

    submitSettingsForm();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Merchant Center ID saved' })
      );
    });
  });
});
